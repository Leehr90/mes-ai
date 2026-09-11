"""
PROD-DEF: Domain exceptions.
"""

from mes.framework.api.exceptions import MESException


class DuplicateProductException(MESException):
    """Raised when a product with the same code+version already exists."""

    status_code = 409
    error_code = "DUPLICATE_PRODUCT"

    def __init__(self, code: str, version: str) -> None:
        super().__init__(
            message=f"Product with code '{code}' version '{version}' already exists",
            details={"code": code, "version": version},
        )


class DuplicateDispositionCodeException(MESException):
    """Raised when a disposition code already exists."""

    status_code = 409
    error_code = "DUPLICATE_DISPOSITION_CODE"

    def __init__(self, code: str) -> None:
        super().__init__(
            message=f"Disposition with code '{code}' already exists",
            details={"code": code},
        )


class InvalidParameterValueException(MESException):
    """Raised when a recorded step-parameter value is invalid for the parameter."""

    status_code = 422
    error_code = "INVALID_PARAMETER_VALUE"

    def __init__(self, name: str, data_type: str, detail: str) -> None:
        super().__init__(
            message=(
                f"Invalid value for step parameter '{name}' "
                f"(type {data_type}): {detail}"
            ),
            details={
                "parameter_name": name,
                "data_type": data_type,
                "detail": detail,
            },
        )
