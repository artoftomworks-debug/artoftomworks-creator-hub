"""ArtofTomworks · Drop-to-load (Creator Hub 0.16 DEV).

Frontend-only helper: a picture or video file dropped onto a Load Image / Load Video
node is uploaded and selected in that node - even if the file carries an embedded
workflow (ComfyUI and rgthree would otherwise try to open that workflow instead).
No Python nodes; nothing is changed outside this folder.
"""
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
