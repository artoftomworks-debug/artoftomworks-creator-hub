"""Creator Hub preview control. Reuses the installed KJ preview implementation.

Only this node's sampler wrapper is adapted; installed files and global KJ
classes remain untouched. A changed KJ callback falls back to its normal preview.
"""
import ast
import inspect
import logging
import re
import sys
import textwrap
import threading
import time

import comfy.patcher_extension
import folder_paths
import nodes
from aiohttp import web
from server import PromptServer

_states = {}
_lock = threading.Lock()
_wrapper_cache = {}


def paused(client, consume=True):
    with _lock:
        state = _states.get(client)
        if not state or time.monotonic() - state['at'] > 86400:
            return False
        if consume and state.get('peek', 0):
            state['peek'] -= 1
            return False
        return state['paused']


@PromptServer.instance.routes.post('/creator_hub/preview-control')
async def control(request):
    # ComfyUI runs on loopback; reject browser cross-origin mutation as well.
    origin = request.headers.get('Origin')
    if origin and origin != request.scheme + '://' + request.host:
        return web.json_response({'error': 'Local same-origin only'}, status=403)
    try:
        data = await request.json()
        client = data.get('client_id', '')
        if not re.fullmatch(r'scene-dna-[a-f0-9]{32}', client) or not isinstance(data.get('paused'), bool):
            raise ValueError('Invalid scoped preview control')
        with _lock:
            if len(_states) >= 256 and client not in _states:
                _states.pop(min(_states, key=lambda k: _states[k]['at']))
            _states[client] = {'paused': data['paused'], 'peek': 1 if data.get('peek') else 0, 'at': time.monotonic()}
        guarded_wrapper()  # Verify installed KJ support before claiming control.
        return web.json_response({'backendControlled': True, 'paused': data['paused']})
    except Exception as e:
        return web.json_response({'backendControlled': False, 'message': str(e)[:400]})


def guarded_wrapper():
    kj = nodes.NODE_CLASS_MAPPINGS.get('ModelPreviewOverrideKJ')
    if not kj:
        raise RuntimeError('KJNodes ModelPreviewOverrideKJ is not installed')
    module = sys.modules[kj.__module__]
    base = getattr(module, '_PreviewOverrideWrapper', None)
    if not base:
        raise RuntimeError('KJ preview wrapper is not available')
    if base in _wrapper_cache:
        return _wrapper_cache[base]
    source = textwrap.dedent(inspect.getsource(base.__call__))
    tree = ast.parse(source)
    method = tree.body[0]
    callbacks = [n for n in method.body if isinstance(n, ast.FunctionDef) and n.name == 'new_callback']
    if len(callbacks) != 1 or not {'original_callback', 'step', 'x0', 'x', 'total_steps_'}.issubset({n.id for n in ast.walk(method) if isinstance(n, ast.Name)}):
        raise RuntimeError('This KJ version has a different preview callback; display pause remains available')
    method.body[0:0] = ast.parse('_creator_hub_client = PromptServer.instance.client_id').body
    callback = callbacks[0]
    index = 1 if isinstance(callback.body[0], ast.Nonlocal) else 0
    callback.body[index:index] = ast.parse('''
if _creator_hub_paused(_creator_hub_client):
    if original_callback is not None:
        original_callback(step, x0, x, total_steps_)
    return
''').body
    scope = dict(module.__dict__)
    scope['_creator_hub_paused'] = paused
    exec(compile(ast.fix_missing_locations(tree), '<Creator Hub scoped preview>', 'exec'), scope)
    wrapper = type('CreatorHubScopedPreview', (base,), {'__call__': scope[method.name]})
    _wrapper_cache[base] = wrapper
    return wrapper


class CreatorHubLivePreview:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'model': ('MODEL',), 'max_resolution': ('INT', {'default': 512, 'min': 128, 'max': 1024}), 'jpeg_quality': ('INT', {'default': 80, 'min': 50, 'max': 95}), 'suppress_default_preview': ('BOOLEAN', {'default': True}), 'preview_frames': ('INT', {'default': 8, 'min': 2, 'max': 16}), 'preview_fps': ('INT', {'default': 4, 'min': 1, 'max': 12})}, 'optional': {'tiny_vae': (['none'] + folder_paths.get_filename_list('vae_approx'),)}, 'hidden': {'unique_id': 'UNIQUE_ID'}}

    RETURN_TYPES = ('MODEL',)
    FUNCTION = 'apply'
    CATEGORY = 'ArtofTomworks/Creator Hub'

    def apply(self, model, max_resolution, jpeg_quality, suppress_default_preview, preview_frames, preview_fps, tiny_vae='none', unique_id=None):
        kj = nodes.NODE_CLASS_MAPPINGS.get('ModelPreviewOverrideKJ')
        if not kj:
            logging.warning('Creator Hub: KJNodes missing; standard Comfy preview remains active')
            return (model,)
        module = sys.modules[kj.__module__]
        try:
            wrapper = guarded_wrapper()
        except Exception as error:
            logging.warning('Creator Hub: %s', error)
            wrapper = getattr(module, '_PreviewOverrideWrapper', None)
            if wrapper is None:
                return (model,)
        patched = model.clone()
        patched.add_wrapper_with_key(comfy.patcher_extension.WrappersMP.OUTER_SAMPLE, 'creator_hub_preview', wrapper(max_resolution, unique_id, jpeg_quality, suppress_default_preview, preview_frames, preview_fps, None, tiny_vae))
        return (patched,)


NODE_CLASS_MAPPINGS = {'CreatorHubLivePreview': CreatorHubLivePreview}
NODE_DISPLAY_NAME_MAPPINGS = {'CreatorHubLivePreview': 'Creator Hub · Controlled Live Preview'}
