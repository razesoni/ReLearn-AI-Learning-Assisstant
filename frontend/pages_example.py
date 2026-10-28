"""
Page routes for the Margin learning frontend (FastAPI + Jinja2).

Include this router in api/main.py:

    from api.pages_example import router as pages_router
    app.include_router(pages_router)

The existing /static mount (frontend/static) is reused unchanged.
Pages are plain shells: the browser checks the session with GET /api/auth/me and
redirects to /login when needed, so these routes do not need to know who is signed in.
"""
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[1] / "frontend" / "templates"))
router = APIRouter(include_in_schema=False)


def _page(template: str):
    async def handler(request: Request, set_id: str | None = None):
        return templates.TemplateResponse(request, template)
    return handler


for path, template in [
    ("/", "index.html"),
    ("/login", "login.html"),
    ("/signup", "signup.html"),
    ("/dashboard", "dashboard.html"),
    ("/library", "library.html"),
    ("/new", "new.html"),
    ("/sets/{set_id}", "set.html"),
    ("/sets/{set_id}/quiz", "quiz.html"),
]:
    router.add_api_route(path, _page(template), methods=["GET"], response_class=HTMLResponse)
