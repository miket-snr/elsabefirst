from datetime import date, datetime
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UserFields(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    firstnames: str = Field(min_length=1, max_length=120)
    surname: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    cellno: str = Field(min_length=3, max_length=40)
    validfrom: date
    validto: date

    @field_validator("username", "firstnames", "surname", "email", "cellno")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()

    @field_validator("cellno")
    @classmethod
    def validate_cellno(cls, value: str) -> str:
        if not value:
            raise ValueError("Cell number is required")
        return value

    @model_validator(mode="after")
    def validate_date_range(self) -> "UserFields":
        if self.validfrom > self.validto:
            raise ValueError("Valid from must be on or before valid to")
        return self


class UserCreate(UserFields):
    pass


class UserUpdate(UserFields):
    pass


class User(UserFields):
    model_config = ConfigDict(from_attributes=True)

    id: int


class NoteFields(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=20000)

    @field_validator("title", "content")
    @classmethod
    def strip_note_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value


class NoteCreate(NoteFields):
    pass


class NoteUpdate(NoteFields):
    pass


class Note(NoteFields):
    id: int
    created_at: datetime
    updated_at: datetime


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)

    @field_validator("identifier")
    @classmethod
    def strip_identifier(cls, value: str) -> str:
        return value.strip()


class OtpVerification(BaseModel):
    temporary_token: str = Field(min_length=1)
    otp: str = Field(min_length=1, max_length=100)


class PasswordLogin(LoginRequest):
    password: str = Field(min_length=1, max_length=128)


class PasswordReset(OtpVerification):
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be blank")
        return value


class OtpRequested(BaseModel):
    temporary_token: str
    message: str


class AuthenticatedUser(BaseModel):
    token: str
    user: User


class ErrorResponse(BaseModel):
    detail: str
