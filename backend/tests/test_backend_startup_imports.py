import importlib
import sys


def _clear_app_modules() -> None:
    for module_name in list(sys.modules):
        if module_name == "app" or module_name.startswith("app."):
            sys.modules.pop(module_name, None)


def test_app_main_imports_without_campaign_service_cycle() -> None:
    _clear_app_modules()

    module = importlib.import_module("app.main")

    assert module.app is not None


def test_campaign_modules_import_without_reentering_campaigns() -> None:
    _clear_app_modules()

    contact_sync = importlib.import_module("app.services.contact_subscriber_sync")
    campaign_preparation = importlib.import_module("app.services.campaign_preparation")

    assert contact_sync.ContactSubscriberSyncService is not None
    assert campaign_preparation.CampaignPreparationService is not None
