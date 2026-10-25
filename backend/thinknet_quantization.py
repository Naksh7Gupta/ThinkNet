"""Model-level quantization transforms for ThinkNet.

Quantization accepts an nn.Module and returns a distinct module; it never
mutates the source model. QuantizerNode operates on models, not activations,
so it is intentionally separate from CompiledGraph's tensor-operation pass.
"""
from __future__ import annotations

from copy import deepcopy

import torch
from torch import nn


SUPPORTED_DTYPES = ("float16", "bfloat16", "int8")


class QuantizerNode(nn.Module):
    """Turn a model into a new model using the requested inference dtype.

    float16/bfloat16 convert floating parameters and buffers to that dtype.
    int8 applies PyTorch dynamic qint8 quantization to Linear modules; other
    module types (for example Conv2d) remain in their original float dtype.
    """

    def __init__(self, dtype: str = "int8") -> None:
        super().__init__()
        if dtype not in SUPPORTED_DTYPES:
            raise ValueError(
                f"Unsupported dtype {dtype!r}; choose one of {SUPPORTED_DTYPES}."
            )
        self.dtype = dtype

    def forward(self, model: nn.Module) -> nn.Module:
        if not isinstance(model, nn.Module):
            raise TypeError("QuantizerNode input must be a torch.nn.Module model.")

        # Never convert the caller's original object in place.
        result = deepcopy(model)
        result.eval()

        if self.dtype == "float16":
            return result.to(dtype=torch.float16)
        if self.dtype == "bfloat16":
            return result.to(dtype=torch.bfloat16)

        linear_count = sum(isinstance(module, nn.Linear) for module in result.modules())
        if linear_count == 0:
            raise ValueError(
                "int8 dynamic quantization requires at least one nn.Linear module."
            )
        return torch.ao.quantization.quantize_dynamic(
            result, {nn.Linear}, dtype=torch.qint8, inplace=False
        )


def quantize_model(model: nn.Module, dtype: str) -> nn.Module:
    """Convenience function returning a quantized copy of a PyTorch model."""
    return QuantizerNode(dtype=dtype)(model)


def quantization_report(model: nn.Module, dtype: str) -> dict[str, int | str]:
    """Report actual quantized modules without claiming full-model INT8."""
    dynamic_linear = sum(
        "quantized.dynamic" in type(module).__module__.lower()
        and "linear" in type(module).__module__.lower()
        for module in model.modules()
    )
    floating_parameters = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.is_floating_point()
    )
    return {
        "dtype": dtype,
        "dynamic_int8_linear_modules": dynamic_linear,
        "floating_parameter_count": floating_parameters,
    }
