from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import Connection

from .. import auth
from ..auth import User, current_user
from ..db import get_conn

router = APIRouter()


class LoginIn(BaseModel):
    username: str
    password: str


def _me(u: User) -> dict:
    return {"id": u.id, "username": u.username, "display_name": u.display_name, "role": u.role,
            "settings": u.settings}


@router.post("/auth/login")
def login(body: LoginIn, response: Response, conn: Connection = Depends(get_conn)):
    return _me(auth.login(conn, response, body.username, body.password))


@router.post("/auth/logout")
def logout(response: Response):
    auth.logout(response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _me(user)
