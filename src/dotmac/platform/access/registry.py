"""
Driver registry for access-network controllers.

The registry ties logical OLT identifiers to driver implementations and
configuration objects. It supports loading definitions from a static config
file but can also be populated programmatically for tests.
"""

from __future__ import annotations

import importlib
import pathlib
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

import yaml

from dotmac.platform.access.drivers.base import BaseOLTDriver, DriverConfig, DriverContext


@dataclass(frozen=True, slots=True)
class DriverDescriptor:
    """Descriptor of a configured driver."""

    driver_cls: type[BaseOLTDriver]
    config: DriverConfig
    context: DriverContext


class AccessDriverRegistry:
    """Registry for OLT drivers."""

    def __init__(self) -> None:
        self._drivers: dict[str, DriverDescriptor] = {}

    def register(self, descriptor: DriverDescriptor) -> None:
        if descriptor.config.olt_id in self._drivers:
            raise ValueError(f"Driver for OLT '{descriptor.config.olt_id}' already registered")
        self._drivers[descriptor.config.olt_id] = descriptor

    def get(self, olt_id: str) -> DriverDescriptor:
        try:
            return self._drivers[olt_id]
        except KeyError as exc:
            raise KeyError(f"No driver registered for OLT '{olt_id}'") from exc

    def descriptors(self) -> Iterable[DriverDescriptor]:
        return self._drivers.values()

    @classmethod
    def from_config_file(
        cls,
        file_path: str | pathlib.Path,
        *,
        context_factory: Callable[[dict[str, Any]], DriverContext] | None = None,
    ) -> AccessDriverRegistry:
        """
        Load registry definitions from a YAML file.

        Example file structure::

            olts:
              - olt_id: olt-huawei-1
                driver: dotmac.platform.access.drivers.huawei.HuaweiCLIDriver
                host: 10.0.0.1
                port: 22
                username: admin
                password: secret
                extra:
                  snmp:
                    community: public
        """

        file_path = pathlib.Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Driver config file not found: {file_path}")

        with file_path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}

        registry = cls()
        for entry in data.get("olts", []):
            driver_cls = _import_driver(entry.pop("driver"))
            config_model = getattr(driver_cls, "CONFIG_MODEL", DriverConfig)
            context_kwargs = entry.pop("context", {})
            config = config_model(**entry)
            context = (
                context_factory(context_kwargs)
                if context_factory
                else DriverContext(**context_kwargs)
            )
            registry.register(
                DriverDescriptor(driver_cls=driver_cls, config=config, context=context)
            )
        return registry


def _import_driver(path: str) -> type[BaseOLTDriver]:
    module_name, _, class_name = path.rpartition(".")
    if not module_name:
        raise ValueError(f"Invalid driver path '{path}'")

    module = importlib.import_module(module_name)
    driver_cls = getattr(module, class_name, None)
    if driver_cls is None:
        raise ImportError(f"Driver class '{class_name}' not found in module '{module_name}'")

    if not issubclass(driver_cls, BaseOLTDriver):
        raise TypeError(f"{driver_cls} is not a subclass of BaseOLTDriver")

    return driver_cls
