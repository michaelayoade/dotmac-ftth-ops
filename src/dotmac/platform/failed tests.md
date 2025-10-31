FAILED tests/test_db.py::TestDatabaseConnection::test_get_sync_engine - AssertionError: assert Engine(sqlite:///:memory:) == <MagicMock name='creat...
FAILED tests/test_db.py::TestDatabaseConnection::test_get_async_engine - AssertionError: assert <sqlalchemy.ext.asyncio.engine.AsyncEngine object at...
FAILED tests/test_db.py::TestDatabaseUrls::test_get_database_url_with_url_setting - AssertionError: assert 'sqlite:///./...ac_dev.sqlite' == 'postgresql:/...t:...
FAILED tests/test_db.py::TestDatabaseUrls::test_get_database_url_postgresql_components - AssertionError: assert 'sqlite:///./...ac_dev.sqlite' == 'postgresql:/...t:...
FAILED tests/test_db.py::TestDatabaseUrls::test_get_async_database_url_postgresql - AssertionError: assert 'sqlite+aiosq...ac_dev.sqlite' == 'postgresql+a...:p...
FAILED tests/test_db.py::TestDatabaseUrls::test_get_async_database_url_sqlite - AssertionError: assert 'sqlite+aiosq...ac_dev.sqlite' == 'sqlite+aiosqlite:...
FAILED tests/test_db.py::TestDatabaseUrls::test_get_async_database_url_other - AssertionError: assert 'sqlite+aiosq...ac_dev.sqlite' == 'mysql://user:pass...
FAILED tests/test_db.py::TestSessionManagement::test_get_db_success - AssertionError: assert <sqlalchemy.o...t 0x16f2a23c0> == <MagicMock na...='...
FAILED tests/test_db.py::TestSessionManagement::test_get_db_exception - AssertionError: Expected 'rollback' to have been called once. Called 0 times.
FAILED tests/test_db.py::TestSessionManagement::test_get_async_db_success - AssertionError: assert <sqlalchemy.o...t 0x173ee8050> == <AsyncMock id='616...
FAILED tests/test_db.py::TestSessionManagement::test_get_async_db_exception - AssertionError: Expected 'rollback' to have been called once. Called 0 times.
FAILED tests/test_db.py::TestSessionManagement::test_get_async_session - AssertionError: assert <sqlalchemy.o...t 0x1706d1a70> == <AsyncMock id='615...
FAILED tests/test_db.py::TestSessionManagement::test_get_async_session_exception - AssertionError: Expected 'rollback' to have been called once. Called 0 times.
FAILED tests/test_db.py::TestSessionDependency::test_get_session_dependency_with_asyncmock - AssertionError: assert <sqlalchemy.o...t 0x1734d2f90> == <AsyncMock id='615...
FAILED tests/test_db.py::TestSessionDependency::test_get_session_dependency_with_context_manager - AssertionError: assert <sqlalchemy.o...t 0x1739f1f20> == <AsyncMock id='616...
FAILED tests/test_db.py::TestSessionDependency::test_get_session_dependency_with_awaitable_asyncmock - AssertionError: assert <sqlalchemy.o...t 0x173955950> == <AsyncMock id='616...
FAILED tests/test_db.py::TestSessionDependency::test_get_session_dependency_with_awaitable_session - AssertionError: assert <sqlalchemy.o...t 0x173ccd450> == <AsyncMock id='615...
FAILED tests/test_db.py::TestSessionDependency::test_get_session_dependency_with_plain_session - AssertionError: assert <sqlalchemy.orm.session.AsyncSession object at 0x16f...
FAILED tests/test_db.py::TestDatabaseOperations::test_create_all_tables - AssertionError: expected call not found.
FAILED tests/test_db.py::TestDatabaseOperations::test_create_all_tables_async - AssertionError: Expected 'run_sync' to have been called once. Called 0 times.
FAILED tests/test_db.py::TestDatabaseOperations::test_drop_all_tables - AssertionError: expected call not found.
FAILED tests/test_db.py::TestDatabaseOperations::test_drop_all_tables_async - AssertionError: Expected 'run_sync' to be called once. Called 0 times.
FAILED tests/test_db.py::TestDatabaseOperations::test_init_db - AssertionError: Expected 'create_all_tables' to have been called once. Call...
FAILED tests/test_db.py::TestHealthCheck::test_check_database_health_success - AssertionError: Expected 'execute' to have been called once. Called 0 times.
FAILED tests/test_db.py::TestHealthCheck::test_check_database_health_failure - assert True is False
FAILED tests/test_health_edge_cases.py::TestStartupDependenciesEdgeCases::test_ensure_infrastructure_running_output_content - AssertionError: assert 'Celery (background tasks)' in 'Starting DotMac Plat...
FAILED tests/test_platform_init.py::TestPlatformInitialization::test_initialize_platform_services_with_configs - AttributeError: module 'dotmac.platform.config' has no attribute 'update'
FAILED tests/test_platform_init.py::TestPlatformModule::test_global_config_instance - AssertionError: assert False
FAILED tests/test_platform_init.py::TestServiceFactories::test_create_jwt_service_success - AttributeError: module 'dotmac.platform.config' has no attribute 'get'
FAILED tests/test_platform_init.py::TestServiceFactories::test_create_jwt_service_import_error - AttributeError: module 'dotmac.platform.config' has no attribute 'get'
FAILED tests/test_platform_init.py::TestServiceFactories::test_create_secrets_manager_auto_backend - AttributeError: module 'dotmac.platform.config' has no attribute 'get'
FAILED tests/test_platform_init.py::TestServiceFactories::test_create_secrets_manager_explicit_backend - AttributeError: module 'dotmac.platform.config' has no attribute 'get'
FAILED tests/test_platform_init.py::TestServiceFactories::test_create_secrets_manager_import_error - AttributeError: module 'dotmac.platform.config' has no attribute 'get'
FAILED tests/test_platform_init.py::TestServiceFactories::test_create_observability_manager_success - NameError: name 'mock_app' is not defined
FAILED tests/test_tasks.py::TestCeleryTasks::test_idempotent_task_no_redis - AssertionError: Expected 'warning' to be called once. Called 0 times.
FAILED tests/auth/test_multi_tenant_auth.py::TestMultiTenantProfileUpdate::test_profile_update_duplicate_username_across_tenants - assert 401 == 200
FAILED tests/auth/test_multi_tenant_auth.py::TestMultiTenantProfileUpdate::test_profile_update_duplicate_username_same_tenant_fails - assert 401 == 200
FAILED tests/auth/test_rbac_coverage_boost.py::TestPermissionWildcards::test_user_has_all_permissions - assert not True
FAILED tests/auth/test_rbac_service_comprehensive.py::TestUserPermissions::test_user_has_all_permissions_failure - assert True is False
FAILED tests/billing/test_config_comprehensive.py::TestBillingConfigFromEnv::test_from_env_with_stripe - assert None is not None
FAILED tests/billing/test_config_comprehensive.py::TestBillingConfigFromEnv::test_from_env_with_paypal - assert None is not None
FAILED tests/billing/test_config_comprehensive.py::TestBillingConfigFromEnv::test_from_env_with_tax_config - AssertionError: assert None == 'avalara_key'
FAILED tests/billing/test_config_comprehensive.py::TestBillingConfigFromEnv::test_from_env_with_webhook_config - assert None is not None
FAILED tests/billing/test_invoice_integration.py::TestInvoiceCreation::test_create_invoice_with_currency_normalization - assert None is not None
FAILED tests/billing/test_metrics_router_comprehensive.py::TestRouterIntegration::test_billing_router_exists - AssertionError: assert 'Billing Metrics' in []
FAILED tests/billing/test_metrics_router_comprehensive.py::TestRouterIntegration::test_customer_metrics_router_exists - AssertionError: assert 'Customer Metrics' in []
FAILED tests/billing/test_payment_integration.py::TestPaymentRefunds::test_cannot_refund_already_refunded_payment - AssertionError: Regex pattern did not match.
FAILED tests/billing/test_payments_router.py::TestGetFailedPayments::test_get_failed_payments_with_data - assert 6.0 == 600.0
FAILED tests/billing/test_payments_router.py::TestGetFailedPayments::test_get_failed_payments_ignores_successful - assert 6.0 == 600.0
FAILED tests/billing/test_payments_router.py::TestGetFailedPayments::test_get_failed_payments_only_last_30_days - assert 250.0 == 25000.0
FAILED tests/billing/test_subscription_e2e.py::TestSubscriptionLifecycle::test_cancel_subscription_at_period_end - AssertionError: assert <Subscription...G: 'trialing'> == <Subscription...D:...
FAILED tests/billing/test_subscription_integration.py::TestSubscriptionCancellation::test_cancel_subscription_at_period_end - AssertionError: assert <Subscription...IVE: 'active'> == <Subscription...D:...
FAILED tests/billing/test_subscription_invoice_integration.py::TestRefundInvoices::test_refund_invoice_on_cancellation - AssertionError: assert <Subscription...NDED: 'ended'> == <Subscription...D:...
FAILED tests/billing/test_subscription_load.py::TestSubscriptionLoadPerformance::test_list_subscriptions_pagination_performance - TypeError: SubscriptionService.list_subscriptions() got an unexpected keywo...
FAILED tests/billing/test_subscription_load.py::TestSubscriptionLoadPerformance::test_concurrent_subscription_operations - AssertionError: assert 99 == 0
FAILED tests/billing/test_subscription_load.py::TestSubscriptionLoadPerformance::test_plan_change_performance_at_scale - TypeError: SubscriptionService.change_plan() got an unexpected keyword argu...
FAILED tests/billing/test_subscription_load.py::test_complete_load_test_scenario - TypeError: SubscriptionService.change_plan() got an unexpected keyword argu...
FAILED tests/billing/test_subscription_payment_integration.py::TestRefundProcessing::test_prorated_refund_on_cancellation - AssertionError: assert <Subscription...NDED: 'ended'> == <Subscription...D:...
FAILED tests/billing/test_subscription_webhooks.py::TestWebhookEventEmission::test_subscription_created_emits_webhook - AttributeError: <module 'dotmac.platform.webhooks.service' from '/Users/mic...
FAILED tests/billing/test_subscription_webhooks.py::TestWebhookEventEmission::test_plan_change_emits_webhook - TypeError: SubscriptionService.change_plan() got an unexpected keyword argu...
FAILED tests/billing/test_webhook_handlers.py::TestStripeWebhookHandler::test_process_charge_refunded - AssertionError: assert Decimal('500') == Decimal('5.00')
FAILED tests/billing/addons/test_addon_router_integration.py::TestPurchaseAddon::test_purchase_addon_invalid_quantity - assert 401 in [400, 422]
FAILED tests/billing/addons/test_addon_router_integration.py::TestGetAddonById::test_get_addon_not_found - assert 401 == 404
FAILED tests/billing/dunning/test_dunning_integration.py::TestDunningCampaignManagement::test_create_campaign_validation_error - pydantic_core._pydantic_core.ValidationError: 1 validation error for Dunnin...
FAILED tests/billing/dunning/test_dunning_integration.py::TestDunningCampaignManagement::test_delete_campaign_success - Failed: DID NOT RAISE <class 'dotmac.platform.core.exceptions.EntityNotFoun...
FAILED tests/billing/dunning/test_dunning_integration.py::TestDunningCampaignManagement::test_list_campaigns - TypeError: DunningService.list_campaigns() got an unexpected keyword argume...
FAILED tests/billing/dunning/test_models.py::TestDunningActionConfigSchema::test_excessive_delay_days_rejected - Failed: DID NOT RAISE <class 'pydantic_core._pydantic_core.ValidationError'>
FAILED tests/billing/dunning/test_models.py::TestDunningActionConfigSchema::test_email_without_template_rejected - Failed: DID NOT RAISE <class 'pydantic_core._pydantic_core.ValidationError'>
FAILED tests/billing/dunning/test_models.py::TestDunningActionConfigSchema::test_webhook_without_url_rejected - Failed: DID NOT RAISE <class 'pydantic_core._pydantic_core.ValidationError'>
FAILED tests/billing/dunning/test_models.py::TestDunningCampaignCreateSchema::test_trigger_after_days_validation - Failed: DID NOT RAISE <class 'pydantic_core._pydantic_core.ValidationError'>
FAILED tests/billing/dunning/test_models.py::TestDunningCampaignModel::test_campaign_model_fields - AssertionError: assert False
FAILED tests/billing/dunning/test_models.py::TestDunningExecutionModel::test_execution_model_fields - AssertionError: assert False
FAILED tests/billing/dunning/test_models.py::TestDunningActionLogModel::test_action_log_model_fields - AssertionError: assert False
FAILED tests/billing/dunning/test_service.py::TestDunningCampaignCRUD::test_create_campaign_validation_no_actions - pydantic_core._pydantic_core.ValidationError: 1 validation error for Dunnin...
FAILED tests/billing/dunning/test_service.py::TestDunningCampaignCRUD::test_get_campaign_wrong_tenant - dotmac.platform.core.exceptions.EntityNotFoundError: Campaign a290bc5e-6adc...
FAILED tests/billing/dunning/test_service.py::TestDunningExecutions::test_start_execution_duplicate_subscription - dotmac.platform.core.exceptions.ValidationError: Active dunning execution a...
FAILED tests/billing/dunning/test_service.py::TestDunningExecutions::test_cancel_execution - assert <dotmac.platform.billing.dunning.models.DunningExecution object at 0...
FAILED tests/billing/dunning/test_tasks.py::TestProcessPendingActions::test_process_pending_actions_success - KeyError: 'errors'
FAILED tests/billing/dunning/test_tasks.py::TestProcessPendingActions::test_process_pending_actions_no_pending - KeyError: 'errors'
FAILED tests/billing/dunning/test_tasks.py::TestProcessPendingActions::test_process_pending_actions_retry_on_failure - KeyError: 'errors'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_email_action_success - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_sms_action_success - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_suspend_service_action - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_terminate_service_action - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_webhook_action - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_action_failure - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestExecuteDunningAction::test_execute_action_retry_on_transient_error - KeyError: 'status'
FAILED tests/billing/dunning/test_tasks.py::TestActionExecutionLogic::test_execute_action_logs_created - AttributeError: <module 'dotmac.platform.billing.dunning.tasks' from '/User...
FAILED tests/billing/dunning/test_tasks.py::TestActionExecutionLogic::test_execute_action_execution_not_found - AttributeError: <module 'dotmac.platform.billing.dunning.tasks' from '/User...
FAILED tests/billing/dunning/test_tasks.py::TestIntegrationScenarios::test_full_dunning_workflow - KeyError: 'errors'
FAILED tests/billing/dunning/test_tasks.py::TestIntegrationScenarios::test_multi_step_execution_sequence - KeyError: 'status'
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCRUD::test_create_invoice_success - assert 401 == 201
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCRUD::test_create_invoice_validation_error - assert 401 == 422
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCRUD::test_get_invoice_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCRUD::test_get_invoice_not_found - assert 401 == 404
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCRUD::test_list_invoices_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCRUD::test_list_invoices_with_filters - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceLifecycle::test_finalize_invoice_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceLifecycle::test_void_invoice_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceLifecycle::test_mark_invoice_paid_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceCredits::test_apply_credit_to_invoice_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceUtilities::test_check_overdue_invoices_success - assert 401 == 200
FAILED tests/billing/invoicing/test_invoicing_router.py::TestInvoiceUtilities::test_check_overdue_invoices_none_overdue - assert 401 == 200
FAILED tests/billing/payments/test_payment_creation_service.py::TestPaymentCreation::test_create_payment_no_provider_mock_success - AssertionError: assert 'failed' == <PaymentStatu...: 'succeeded'>
FAILED tests/billing/payments/test_payment_critical_fixes_batch3.py::TestRetryFailedPaymentHandlers::test_retry_success_calls_handle_payment_success - KeyError: 'invoice_ids'
FAILED tests/billing/payments/test_payment_refunds_service.py::TestPaymentRefunds::test_refund_failed_payment - AssertionError: Regex pattern did not match.
FAILED tests/billing/payments/test_payment_refunds_service.py::TestPaymentRefunds::test_refund_amount_exceeds_original - AssertionError: Regex pattern did not match.
FAILED tests/billing/payments/test_payment_refunds_service.py::TestPaymentRefunds::test_refund_no_provider_mock_success - AssertionError: assert 'failed' == <PaymentStatu...D: 'refunded'>
FAILED tests/billing/payments/test_payment_retry_service.py::TestRetryFailedPayments::test_retry_payment_no_provider_mock_success - AssertionError: assert 'failed' == <PaymentStatu...: 'succeeded'>
FAILED tests/billing/payments/test_payment_router_security.py::TestFailedPaymentsTenantIsolation::test_failed_payments_scoped_by_tenant - assert 50.0 == 5000.0
FAILED tests/billing/payments/test_payment_router_security.py::TestFailedPaymentsTenantIsolation::test_failed_payments_different_tenants_isolated - assert 30.0 == 3000.0
FAILED tests/billing/payments/test_payment_service_core.py::TestPaymentCreation::test_create_payment_without_provider - AssertionError: assert 'failed' == <PaymentStatu...: 'succeeded'>
FAILED tests/billing/payments/test_payment_service_core.py::TestPaymentRefunds::test_refund_payment_not_successful - AssertionError: Regex pattern did not match.
FAILED tests/billing/payments/test_payment_service_core.py::TestPaymentRefunds::test_refund_payment_exceeds_amount - AssertionError: Regex pattern did not match.
FAILED tests/billing/subscriptions/test_subscription_critical_fixes.py::TestCancelAtPeriodEnd::test_cancel_immediate_sets_status_ended - dotmac.platform.billing.exceptions.SubscriptionError: Cannot cancel subscri...
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_create_contact_requires_create_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_get_contact_requires_read_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_update_contact_requires_update_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_delete_contact_requires_delete_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_search_contacts_requires_read_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_add_contact_method_requires_update_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_record_activity_requires_manage_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_bulk_update_requires_update_permission - assert 400 == 403
FAILED tests/contacts/test_contacts_router_comprehensive.py::TestContactsPermissions::test_bulk_delete_requires_delete_permission - assert 400 == 403
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_create_contact - assert 404 == 201
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_get_contact - assert 404 == 200
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_get_contact_not_found - AssertionError: assert 'Not Found' == 'Contact not found'
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_update_contact - assert 404 == 200
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_update_contact_not_found - AssertionError: assert 'Not Found' == 'Contact not found'
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_delete_contact - assert 404 == 204
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_search_contacts - assert 404 == 200
FAILED tests/contacts/test_router.py::TestContactEndpoints::test_search_contacts_with_filters - assert 404 == 200
FAILED tests/contacts/test_router.py::TestContactPermissions::test_create_requires_permission - assert 404 == 403
FAILED tests/contacts/test_router.py::TestContactPermissions::test_read_requires_permission - assert 404 == 403
FAILED tests/crm/test_crm_services.py::TestLeadService::test_get_lead_not_found - TypeError: EntityNotFoundError.__init__() got an unexpected keyword argumen...
FAILED tests/customer_management/test_customer_router.py::TestCustomerCRUD::test_create_customer_success - assert 401 == 201
FAILED tests/customer_management/test_customer_router.py::TestCustomerCRUD::test_get_customer_success - assert 401 == 200
FAILED tests/customer_management/test_customer_router.py::TestCustomerCRUD::test_get_customer_not_found - assert 401 == 404
FAILED tests/customer_management/test_customer_router.py::TestCustomerCRUD::test_get_customer_by_number_success - assert 401 == 200
FAILED tests/customer_management/test_customer_router.py::TestCustomerCRUD::test_update_customer_success - assert 401 == 200
FAILED tests/customer_management/test_customer_router.py::TestCustomerCRUD::test_delete_customer_success - assert 401 == 204
FAILED tests/customer_management/test_customer_router.py::TestCustomerSearch::test_search_customers_success - assert 401 == 200
FAILED tests/customer_management/test_customer_router.py::TestCustomerActivities::test_add_customer_activity_success - assert 401 == 201
FAILED tests/customer_management/test_customer_router.py::TestCustomerActivities::test_get_customer_activities_success - assert 401 == 200
FAILED tests/customer_management/test_customer_router.py::TestCustomerMetrics::test_record_purchase_success - assert 401 == 204
FAILED tests/customer_management/test_customer_router.py::TestCustomerMetrics::test_get_customer_metrics_success - assert 401 == 200
FAILED tests/customer_management/test_customer_router.py::TestCustomerSegments::test_create_segment_success - assert 401 == 201
FAILED tests/customer_management/test_customer_router.py::TestCustomerSegments::test_recalculate_segment_success - assert 401 == 200
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestAuthenticationBoundaries::test_usage_history_requires_auth - assert 404 in [401, 403]
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestAuthenticationBoundaries::test_payment_methods_require_auth - assert 404 in [401, 403]
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestAuthenticationBoundaries::test_invoice_download_requires_auth - assert 404 in [401, 403]
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestCustomerDataIsolation::test_customer_cannot_access_other_customer_invoice - pydantic_core._pydantic_core.ValidationError: 6 validation errors for Invoice
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestUsageHistoryEndpoint::test_get_usage_history_success - assert 404 == 200
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestUsageHistoryEndpoint::test_get_usage_history_different_time_ranges - assert 404 == 200
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestUsageReportGeneration::test_generate_usage_report_success - assert 404 == 200
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestUsageReportGeneration::test_generate_usage_report_pdf_structure - assert 404 == 200
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestInvoiceDownload::test_download_invoice_success - pydantic_core._pydantic_core.ValidationError: 6 validation errors for Invoice
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestInvoiceDownload::test_download_invoice_invalid_id - assert 404 == 400
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestPaymentMethods::test_list_payment_methods_success - pydantic_core._pydantic_core.ValidationError: 1 validation error for Paymen...
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestPaymentMethods::test_add_payment_method_success - pydantic_core._pydantic_core.ValidationError: 1 validation error for Paymen...
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestPaymentMethods::test_set_default_payment_method - pydantic_core._pydantic_core.ValidationError: 1 validation error for Paymen...
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestPaymentMethods::test_remove_payment_method - assert 404 == 204
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestPaymentMethods::test_toggle_autopay - pydantic_core._pydantic_core.ValidationError: 1 validation error for Paymen...
FAILED tests/customer_portal/test_customer_portal_router_comprehensive.py::TestErrorHandling::test_usage_history_database_error - assert 404 == 500
FAILED tests/deployment/test_deployment_router.py::TestDeploymentTemplates::test_list_templates_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentTemplates::test_get_template_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentTemplates::test_get_template_not_found - assert 401 == 404
FAILED tests/deployment/test_deployment_router.py::TestDeploymentTemplates::test_update_template_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentInstances::test_list_instances_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentInstances::test_list_instances_filtered - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentInstances::test_get_instance_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentInstances::test_get_instance_not_found - assert 401 == 404
FAILED tests/deployment/test_deployment_router.py::TestDeploymentInstances::test_get_instance_status_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_provision_deployment_success - assert 401 == 202
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_provision_deployment_validation_error - assert 401 == 400
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_upgrade_deployment_success - assert 401 == 202
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_scale_deployment_success - assert 401 == 202
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_suspend_deployment_success - assert 401 == 202
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_resume_deployment_success - assert 401 == 202
FAILED tests/deployment/test_deployment_router.py::TestDeploymentOperations::test_destroy_deployment_success - assert 401 == 202
FAILED tests/deployment/test_deployment_router.py::TestDeploymentExecutions::test_list_executions_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentExecutions::test_get_execution_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentExecutions::test_get_execution_not_found - assert 401 == 404
FAILED tests/deployment/test_deployment_router.py::TestDeploymentHealth::test_list_health_records_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentHealth::test_trigger_health_check_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentStatistics::test_get_deployment_stats_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentStatistics::test_get_template_usage_stats_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestDeploymentStatistics::test_get_resource_allocation_success - assert 401 == 200
FAILED tests/deployment/test_deployment_router.py::TestScheduledDeployments::test_schedule_deployment_success - assert 401 == 201
FAILED tests/e2e/test_billing_e2e.py::TestProductCatalogE2E::test_update_product_price - assert 422 == 200
FAILED tests/e2e/test_billing_e2e.py::TestBillingCatalogErrorHandling::test_get_nonexistent_product - assert 422 == 404
FAILED tests/e2e/test_billing_e2e.py::TestBillingCatalogErrorHandling::test_update_nonexistent_product - assert 422 == 404
FAILED tests/e2e/test_communications_e2e.py::TestEmailSendingE2E::test_send_email_complete_flow - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestEmailSendingE2E::test_send_email_validation_error - assert 404 == 422
FAILED tests/e2e/test_communications_e2e.py::TestEmailSendingE2E::test_send_email_service_failure - assert 404 == 500
FAILED tests/e2e/test_communications_e2e.py::TestEmailQueueingE2E::test_queue_email_for_background_processing - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestEmailQueueingE2E::test_bulk_email_queue - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateManagementE2E::test_create_template_flow - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateManagementE2E::test_list_templates - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateManagementE2E::test_get_template_by_id - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateManagementE2E::test_delete_template - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateRenderingE2E::test_render_template_with_variables - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateRenderingE2E::test_quick_render_inline_template - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestTemplateRenderingE2E::test_render_template_missing_variables - KeyError: 'id'
FAILED tests/e2e/test_communications_e2e.py::TestTemplateAndEmailIntegrationE2E::test_send_email_using_template - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestCommunicationMetricsE2E::test_get_communication_stats - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestCommunicationMetricsE2E::test_get_recent_activity - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestCommunicationMetricsE2E::test_email_logging_integration - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestBulkEmailWorkflowE2E::test_complete_bulk_email_workflow - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestHealthCheckE2E::test_communications_health - assert 404 in [200, 400, 401]
FAILED tests/e2e/test_communications_e2e.py::TestErrorHandlingE2E::test_send_email_with_malformed_json - assert 404 == 422
FAILED tests/e2e/test_communications_e2e.py::TestConcurrentOperationsE2E::test_send_multiple_emails_concurrently - assert 404 == 200
FAILED tests/e2e/test_communications_e2e.py::TestConcurrentOperationsE2E::test_create_multiple_templates_concurrently - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_from_csv_file - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_from_database - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_from_s3 - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_from_api - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_with_field_mapping - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_dry_run_mode - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestImportDataE2E::test_import_with_error_skipping - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_to_csv_file - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_to_json_with_compression - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_to_excel - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_to_s3 - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_to_email - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_to_database - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestExportDataE2E::test_export_with_filters - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobStatusE2E::test_get_job_status_success - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobStatusE2E::test_get_job_status_invalid_uuid - assert 404 == 400
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobStatusE2E::test_get_job_status_shows_timestamps - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobStatusE2E::test_get_job_status_shows_progress - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobListingE2E::test_list_all_jobs - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobListingE2E::test_list_jobs_with_pagination - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobListingE2E::test_list_jobs_filter_by_type - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobListingE2E::test_list_jobs_filter_by_status - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobListingE2E::test_list_jobs_combined_filters - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobListingE2E::test_list_jobs_empty_result - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobCancellationE2E::test_cancel_job_success - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobCancellationE2E::test_cancel_running_job - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestJobCancellationE2E::test_cancel_pending_job - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestFormatDiscoveryE2E::test_list_supported_formats - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestFormatDiscoveryE2E::test_format_details_include_metadata - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestFormatDiscoveryE2E::test_format_compression_types - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestFormatDiscoveryE2E::test_json_format_details - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestFormatDiscoveryE2E::test_excel_format_details - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestCompleteWorkflowE2E::test_complete_import_workflow - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestCompleteWorkflowE2E::test_complete_export_workflow - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestCompleteWorkflowE2E::test_format_discovery_before_import - assert 404 == 200
FAILED tests/e2e/test_data_transfer_e2e.py::TestCompleteWorkflowE2E::test_multiple_concurrent_jobs - assert False
FAILED tests/e2e/test_file_storage_e2e.py::TestFileUploadE2E::test_upload_file_success - AssertionError: assert '17381c20-c69...-cb90ec34bd4d' == '899b330f-bae...-a...
FAILED tests/e2e/test_file_storage_e2e.py::TestFileUploadE2E::test_upload_file_without_path - AssertionError: assert '4a58fb38-bcd...-da43070c643a' == '82580ef5-b78...-4...
FAILED tests/e2e/test_file_storage_e2e.py::TestFileUploadE2E::test_upload_file_storage_error - assert 200 == 500
FAILED tests/e2e/test_file_storage_e2e.py::TestFileDownloadE2E::test_download_file_success - assert 404 == 200
FAILED tests/e2e/test_file_storage_e2e.py::TestFileDownloadE2E::test_download_file_storage_error - assert 404 == 500
FAILED tests/e2e/test_file_storage_e2e.py::TestFileDownloadE2E::test_download_binary_file - assert 404 == 200
FAILED tests/e2e/test_file_storage_e2e.py::TestFileDownloadE2E::test_download_zero_byte_file - assert 404 == 200
FAILED tests/e2e/test_file_storage_e2e.py::TestFileDeleteE2E::test_delete_file_success - assert 404 == 200
FAILED tests/e2e/test_file_storage_e2e.py::TestFileDeleteE2E::test_delete_file_storage_error - assert 404 == 500
FAILED tests/e2e/test_file_storage_e2e.py::TestFileListE2E::test_list_files_success - AssertionError: assert 3 == 2
FAILED tests/e2e/test_file_storage_e2e.py::TestFileListE2E::test_list_files_with_pagination - AttributeError: 'NoneType' object has no attribute 'kwargs'
FAILED tests/e2e/test_file_storage_e2e.py::TestFileListE2E::test_list_files_with_path_filter - AttributeError: 'NoneType' object has no attribute 'kwargs'
FAILED tests/e2e/test_file_storage_e2e.py::TestFileListE2E::test_list_files_empty - AssertionError: assert [{'checksum':...0c643a', ...}] == []
FAILED tests/e2e/test_file_storage_e2e.py::TestFileListE2E::test_list_files_error - assert 200 == 500
FAILED tests/e2e/test_file_storage_e2e.py::TestFileMetadataE2E::test_get_metadata_success - assert 404 == 200
FAILED tests/e2e/test_file_storage_e2e.py::TestFileMetadataE2E::test_get_metadata_error - assert 404 == 500
FAILED tests/e2e/test_file_storage_e2e.py::TestBatchOperationsE2E::test_batch_delete_success - assert False
FAILED tests/e2e/test_file_storage_e2e.py::TestBatchOperationsE2E::test_batch_delete_partial_failure - AssertionError: assert 'failed' == 'deleted'
FAILED tests/e2e/test_file_storage_e2e.py::TestBatchOperationsE2E::test_batch_move_operation - assert False
FAILED tests/e2e/test_file_storage_e2e.py::TestBatchOperationsE2E::test_batch_copy_operation - assert False
FAILED tests/e2e/test_file_storage_e2e.py::TestBatchOperationsE2E::test_batch_operation_error - assert 200 == 500
FAILED tests/e2e/test_file_storage_e2e.py::TestCompleteWorkflowE2E::test_complete_file_lifecycle - AssertionError: assert '090e53e1-ebe...-c4836eff509f' == '7bbe2c55-c9c...-1...
FAILED tests/e2e/test_file_storage_e2e.py::TestCompleteWorkflowE2E::test_multi_file_upload_and_list - AssertionError: assert 7 == 3
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAdminHealth::test_platform_admin_health_check - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAdminHealth::test_non_admin_cannot_access_health - assert 404 in [401, 403]
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_list_all_tenants - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_list_tenants_pagination - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_tenant_counts_accurate - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_non_admin_cannot_list_tenants - assert 404 in [401, 403]
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_get_tenant_detail - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_get_tenant_detail_returns_billing_metrics_fields - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantListing::test_non_admin_cannot_get_tenant_detail - assert 404 in [401, 403]
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformStats::test_get_platform_stats - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformStats::test_system_health_check - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformPermissions::test_list_platform_permissions - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantImpersonation::test_create_impersonation_token - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantImpersonation::test_impersonation_token_duration_limits - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestTenantImpersonation::test_non_admin_cannot_impersonate - assert 404 in [401, 403]
FAILED tests/e2e/test_platform_admin_e2e.py::TestCrossTenantSearch::test_cross_tenant_search - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestCrossTenantSearch::test_cross_tenant_search_with_tenant_filter - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAuditLog::test_get_recent_platform_actions - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAuditLog::test_audit_log_limit_validation - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestSystemManagement::test_clear_system_cache - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestSystemManagement::test_clear_all_caches - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestSystemManagement::test_get_system_configuration - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestSystemManagement::test_non_admin_cannot_manage_system - assert 404 in [401, 403]
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAdminAuthorization::test_platform_admin_flag_required - AssertionError: Endpoint /api/v1/admin/platform/health should be protected
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAdminAuthorization::test_specific_permissions_enforced - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAdminE2EWorkflow::test_complete_platform_monitoring_workflow - assert 404 == 200
FAILED tests/e2e/test_platform_admin_e2e.py::TestPlatformAdminE2EWorkflow::test_tenant_investigation_workflow - assert 404 == 200
FAILED tests/e2e/test_webhooks_e2e.py::TestWebhookSubscriptionCRUD::test_create_webhook_subscription_success - KeyError: 'url'
FAILED tests/e2e/test_webhooks_e2e.py::TestWebhookLifecycleE2E::test_complete_webhook_lifecycle - KeyError: 'id'
FAILED tests/examples/example_router_test.py::TestBasicRouterPatterns::test_successful_request - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestBasicRouterPatterns::test_not_found_error - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestBasicRouterPatterns::test_field_validation - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestRouterWithService::test_list_products - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestRouterWithService::test_get_product - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_list_resources - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_get_resource_success - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_get_resource_not_found - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_create_resource - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_update_resource - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_delete_resource - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestCRUDPatterns::test_search_products - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestContractPatterns::test_generate_mock_data - pydantic_core._pydantic_core.ValidationError: 3 validation errors for Product
FAILED tests/examples/example_router_test.py::TestErrorHandlingPatterns::test_unauthorized_access - assert 400 in [401, 403]
FAILED tests/examples/example_router_test.py::TestErrorHandlingPatterns::test_missing_tenant_header - assert 400 == 403
FAILED tests/examples/example_router_test.py::TestErrorHandlingPatterns::test_validation_error - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/examples/example_router_test.py::TestErrorHandlingPatterns::test_not_found - TypeError: argument of type 'NoneType' is not iterable
FAILED tests/feature_flags/test_router.py::TestCreateOrUpdateFlag::test_create_flag_success - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestCreateOrUpdateFlag::test_create_flag_feature_admin_permission - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestCreateOrUpdateFlag::test_create_flag_insufficient_permissions - assert 401 == 403
FAILED tests/feature_flags/test_router.py::TestCreateOrUpdateFlag::test_create_flag_invalid_name - assert 401 == 400
FAILED tests/feature_flags/test_router.py::TestCreateOrUpdateFlag::test_create_flag_service_error - assert 401 == 500
FAILED tests/feature_flags/test_router.py::TestGetFlag::test_get_flag_success - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestGetFlag::test_get_flag_not_found - assert 401 == 404
FAILED tests/feature_flags/test_router.py::TestGetFlag::test_get_flag_service_error - assert 401 == 500
FAILED tests/feature_flags/test_router.py::TestListAllFlags::test_list_all_flags - assert 500 == 200
FAILED tests/feature_flags/test_router.py::TestListAllFlags::test_list_enabled_flags_only - assert 500 == 200
FAILED tests/feature_flags/test_router.py::TestListAllFlags::test_list_flags_empty - assert 500 == 200
FAILED tests/feature_flags/test_router.py::TestDeleteFlag::test_delete_flag_success - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestDeleteFlag::test_delete_flag_not_found - assert 401 == 404
FAILED tests/feature_flags/test_router.py::TestDeleteFlag::test_delete_flag_insufficient_permissions - assert 401 == 403
FAILED tests/feature_flags/test_router.py::TestDeleteFlag::test_delete_flag_service_error - assert 401 == 500
FAILED tests/feature_flags/test_router.py::TestCheckFlag::test_check_flag_with_user_context - assert 500 == 200
FAILED tests/feature_flags/test_router.py::TestGetStatus::test_get_status_success - assert 500 == 200
FAILED tests/feature_flags/test_router.py::TestGetStatus::test_get_status_redis_unavailable - assert 500 == 200
FAILED tests/feature_flags/test_router.py::TestAdminEndpoints::test_clear_cache_success - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestAdminEndpoints::test_clear_cache_non_admin - assert 401 == 403
FAILED tests/feature_flags/test_router.py::TestAdminEndpoints::test_sync_redis_success - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestAdminEndpoints::test_sync_redis_non_admin - assert 401 == 403
FAILED tests/feature_flags/test_router.py::TestBulkOperations::test_bulk_update_success - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestBulkOperations::test_bulk_update_partial_failure - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestBulkOperations::test_bulk_update_insufficient_permissions - assert 401 == 403
FAILED tests/feature_flags/test_router.py::TestResponseModels::test_feature_flag_response_model - assert 401 == 200
FAILED tests/feature_flags/test_router.py::TestResponseModels::test_flag_status_response_health_calculation - KeyError: 'healthy'
FAILED tests/integration/test_complete_provisioning_workflow.py::TestCompleteProvisioningWorkflow::test_complete_dual_stack_provisioning_e2e - TypeError: WireGuardService.__init__() missing 1 required positional argume...
FAILED tests/integration/test_complete_provisioning_workflow.py::TestCompleteProvisioningWorkflow::test_provisioning_with_auto_allocation_e2e - TypeError: WireGuardService.__init__() missing 1 required positional argume...
FAILED tests/integration/test_complete_provisioning_workflow.py::TestCompleteProvisioningWorkflow::test_provisioning_ipv4_only_legacy_support - TypeError: WireGuardService.__init__() missing 1 required positional argume...
FAILED tests/integration/test_complete_provisioning_workflow.py::TestCompleteProvisioningWorkflow::test_deprovisioning_cleanup_e2e - TypeError: WireGuardService.__init__() missing 1 required positional argume...
FAILED tests/integration/test_complete_provisioning_workflow.py::TestCompleteProvisioningWorkflow::test_bulk_provisioning_performance - pydantic_core._pydantic_core.ValidationError: 1 validation error for RADIUS...
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_provision_subscriber_with_dual_stack_ips_integration - AttributeError: 'RADIUSSubscriberResponse' object has no attribute 'framed_...
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_provision_subscriber_ipv4_only_integration - AttributeError: 'RADIUSSubscriberResponse' object has no attribute 'framed_...
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_provision_subscriber_ipv6_only_integration - AttributeError: 'RADIUSSubscriberResponse' object has no attribute 'framed_...
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_update_subscriber_add_ipv6_to_ipv4_integration - AttributeError: 'NoneType' object has no attribute 'subscriber_id'
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_provision_subscriber_with_bandwidth_profile_integration - AttributeError: 'RADIUSSubscriberResponse' object has no attribute 'downloa...
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_bulk_provision_subscribers_dual_stack - pydantic_core._pydantic_core.ValidationError: 1 validation error for RADIUS...
FAILED tests/integration/test_dual_stack_subscriber_provisioning.py::TestDualStackSubscriberProvisioning::test_delete_subscriber_cleanup_dual_stack - assert None is not None
FAILED tests/integration/test_netbox_dual_stack_integration.py::TestNetBoxDualStackIntegration::test_allocate_dual_stack_with_tags - TypeError: NetBoxClient.allocate_dual_stack_ips() got an unexpected keyword...
FAILED tests/integration/test_netbox_dual_stack_integration.py::TestNetBoxDualStackIntegration::test_update_ip_dns_name - AttributeError: 'NetBoxClient' object has no attribute 'update_ip'
FAILED tests/integration/test_netbox_dual_stack_integration.py::TestNetBoxDualStackIntegration::test_release_dual_stack_ips - AttributeError: 'NetBoxClient' object has no attribute 'delete_ip'. Did you...
FAILED tests/integration/test_netbox_dual_stack_integration.py::TestNetBoxDualStackIntegration::test_search_ips_by_dns_name - AttributeError: 'NetBoxClient' object has no attribute 'search_ips'
FAILED tests/integration/test_phase1_smoke.py::TestISPCustomerFieldsSmoke::test_create_customer_with_isp_fields - TypeError: 'service_location' is an invalid keyword argument for Customer
FAILED tests/integration/test_phase1_smoke.py::TestISPCustomerFieldsSmoke::test_query_customers_by_service_location - TypeError: 'service_location' is an invalid keyword argument for Customer
FAILED tests/integration/test_phase1_smoke.py::TestISPCustomerFieldsSmoke::test_query_customers_by_installation_status - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
FAILED tests/integration/test_phase1_smoke.py::TestEnhancedTicketingSmoke::test_create_ticket_with_isp_fields - TypeError: 'description' is an invalid keyword argument for Ticket
FAILED tests/integration/test_phase1_smoke.py::TestEnhancedTicketingSmoke::test_sla_breach_detection - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
FAILED tests/integration/test_phase1_smoke.py::TestEnhancedTicketingSmoke::test_ticket_escalation - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
FAILED tests/integration/test_phase1_smoke.py::TestUsageBillingSmoke::test_create_usage_record - TypeError: 'created_by_user_id' is an invalid keyword argument for UsageRecord
FAILED tests/integration/test_phase1_smoke.py::TestDatabaseMigrations::test_all_phase1_tables_exist - sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: ...
FAILED tests/integration/test_phase1_smoke.py::TestDatabaseMigrations::test_isp_customer_columns_exist - sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: ...
FAILED tests/integration/test_phase1_smoke.py::TestDatabaseMigrations::test_ticket_isp_columns_exist - sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: ...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_create_dual_stack_server_integration - AttributeError: 'WireGuardServer' object has no attribute 'supports_ipv6'
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_create_ipv4_only_server_integration - AttributeError: 'WireGuardServer' object has no attribute 'supports_ipv6'
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_create_peer_auto_dual_stack_allocation - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_create_multiple_peers_sequential_allocation - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_create_peer_ipv4_only_server - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_create_peer_manual_ips - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_peer_ip_conflict_detection - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_generate_peer_config_dual_stack - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_delete_peer_cleanup - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_peer_expiration - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integration/test_wireguard_dual_stack_integration.py::TestWireGuardDualStackIntegration::test_server_capacity_limits - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create p...
FAILED tests/integrations/test_integrations_router.py::test_list_integrations - assert 404 == 200
FAILED tests/integrations/test_integrations_router.py::test_get_integration_details - assert 404 == 200
FAILED tests/integrations/test_integrations_router.py::test_health_check_integration - assert 404 == 200
FAILED tests/integrations/test_integrations_router.py::test_integration_response_schema - assert 404 == 200
FAILED tests/integrations/test_integrations_router.py::test_list_integrations_empty_registry - assert 404 == 200
FAILED tests/integrations/test_integrations_router.py::test_integration_types_are_valid - assert 404 == 200
FAILED tests/integrations/test_integrations_router.py::test_integration_status_values - assert 404 == 200
FAILED tests/journeys/test_service_lifecycle_journey.py::TestServiceLifecycleJourney::test_service_activation_to_cancellation_journey - TypeError: 'start_date' is an invalid keyword argument for BillingSubscript...
FAILED tests/journeys/test_service_lifecycle_journey_improved.py::TestServiceLifecycleJourneyImproved::test_service_activation_to_cancellation_journey_using_services - TypeError: SubscriptionService.create_plan() got an unexpected keyword argu...
FAILED tests/journeys/test_service_lifecycle_journey_improved.py::TestServiceLifecycleJourneyImproved::test_plan_upgrade_using_service_layer - TypeError: SubscriptionService.create_plan() got an unexpected keyword argu...
FAILED tests/journeys/test_service_lifecycle_journey_improved.py::TestServiceLifecycleBestPractices::test_demonstrates_service_layer_testing_pattern - TypeError: SubscriptionService.create_plan() got an unexpected keyword argu...
FAILED tests/licensing/test_licensing_router.py::TestSecurityValidation::test_emergency_code_success - NameError: name 'UTC' is not defined
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDeviceManagement::test_discover_cpe_device - TypeError: GenieACSService.__init__() takes from 1 to 3 positional argument...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDeviceManagement::test_get_device_info - TypeError: GenieACSService.__init__() takes from 1 to 3 positional argument...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDeviceManagement::test_list_devices_by_tenant - TypeError: GenieACSService.__init__() takes from 1 to 3 positional argument...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDeviceManagement::test_delete_device - TypeError: GenieACSService.__init__() takes from 1 to 3 positional argument...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSParameterConfiguration::test_configure_wifi_parameters - ImportError: cannot import name 'SetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSParameterConfiguration::test_configure_wan_connection - ImportError: cannot import name 'SetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSParameterConfiguration::test_configure_management_server - ImportError: cannot import name 'SetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSParameterConfiguration::test_get_device_parameters - ImportError: cannot import name 'GetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSFirmwareManagement::test_trigger_firmware_upgrade - ImportError: cannot import name 'FirmwareUpgradeRequest' from 'dotmac.platf...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSFirmwareManagement::test_schedule_firmware_upgrade - ImportError: cannot import name 'FirmwareUpgradeRequest' from 'dotmac.platf...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSFirmwareManagement::test_bulk_firmware_upgrade - ImportError: cannot import name 'BulkFirmwareUpgradeRequest' from 'dotmac.p...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDiagnostics::test_ping_diagnostic - ImportError: cannot import name 'DiagnosticRequest' from 'dotmac.platform.g...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDiagnostics::test_traceroute_diagnostic - ImportError: cannot import name 'DiagnosticRequest' from 'dotmac.platform.g...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSDiagnostics::test_speed_test_diagnostic - ImportError: cannot import name 'DiagnosticRequest' from 'dotmac.platform.g...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSBulkOperations::test_bulk_parameter_update - ImportError: cannot import name 'BulkSetParametersRequest' from 'dotmac.pla...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSBulkOperations::test_bulk_reboot - ImportError: cannot import name 'BulkOperationRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSBulkOperations::test_bulk_factory_reset - ImportError: cannot import name 'BulkOperationRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSServiceIntegration::test_provision_ont_for_new_service - ImportError: cannot import name 'SetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSServiceIntegration::test_update_ont_on_service_modification - ImportError: cannot import name 'SetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSServiceIntegration::test_reset_ont_on_service_termination - ImportError: cannot import name 'DeviceOperationRequest' from 'dotmac.platf...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSMonitoring::test_check_device_online_status - TypeError: GenieACSService.__init__() takes from 1 to 3 positional argument...
FAILED tests/oss/test_genieacs_tr069_integration.py::TestGenieACSMonitoring::test_get_device_statistics - TypeError: GenieACSService.__init__() takes from 1 to 3 positional argument...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxIPAddressManagement::test_allocate_ip_from_pool - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxIPAddressManagement::test_allocate_specific_ip - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxIPAddressManagement::test_update_ip_metadata - ImportError: cannot import name 'IPUpdateRequest' from 'dotmac.platform.net...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxIPAddressManagement::test_release_ip_address - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxIPAddressManagement::test_bulk_ip_allocation - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxPrefixManagement::test_create_prefix_pool - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxPrefixManagement::test_get_available_prefixes - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxPrefixManagement::test_allocate_prefix_from_parent - ImportError: cannot import name 'PrefixAllocationRequest' from 'dotmac.plat...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxPrefixManagement::test_prefix_utilization_tracking - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxVLANManagement::test_create_vlan - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxVLANManagement::test_assign_vlan_to_interface - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxVLANManagement::test_get_available_vlans - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxDeviceInterfaces::test_create_device_interface - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxDeviceInterfaces::test_assign_ip_to_interface - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxDeviceInterfaces::test_configure_interface_for_customer - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxServiceIntegration::test_provision_network_resources_for_service - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxServiceIntegration::test_reclaim_network_resources_on_termination - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxServiceIntegration::test_track_network_resource_lifecycle - ImportError: cannot import name 'IPUpdateRequest' from 'dotmac.platform.net...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxReporting::test_get_ip_utilization_report - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxReporting::test_get_vlan_usage_report - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_netbox_ipam_integration.py::TestNetBoxReporting::test_get_interface_status_report - TypeError: NetBoxService.__init__() takes from 1 to 3 positional arguments ...
FAILED tests/oss/test_radius_integration.py::TestRADIUSSubscriberLifecycle::test_update_subscriber_bandwidth - TypeError: RADIUSService.update_subscriber() got an unexpected keyword argu...
FAILED tests/oss/test_radius_integration.py::TestRADIUSSubscriberLifecycle::test_suspend_and_resume_subscriber - AttributeError: 'RADIUSService' object has no attribute 'suspend_subscriber...
FAILED tests/oss/test_radius_integration.py::TestRADIUSSubscriberLifecycle::test_terminate_subscriber - TypeError: RADIUSService.delete_subscriber() got an unexpected keyword argu...
FAILED tests/oss/test_radius_integration.py::TestRADIUSSessionManagement::test_start_radius_session - AttributeError: 'RADIUSService' object has no attribute 'start_session'
FAILED tests/oss/test_radius_integration.py::TestRADIUSSessionManagement::test_update_session_accounting - AttributeError: 'RADIUSService' object has no attribute 'start_session'
FAILED tests/oss/test_radius_integration.py::TestRADIUSSessionManagement::test_stop_radius_session - AttributeError: 'RADIUSService' object has no attribute 'start_session'
FAILED tests/oss/test_radius_integration.py::TestRADIUSSessionManagement::test_get_active_sessions - AttributeError: 'RADIUSService' object has no attribute 'start_session'
FAILED tests/oss/test_radius_integration.py::TestRADIUSNASConfiguration::test_create_nas_server - pydantic_core._pydantic_core.ValidationError: 2 validation errors for NASCr...
FAILED tests/oss/test_radius_integration.py::TestRADIUSNASConfiguration::test_update_nas_secret - pydantic_core._pydantic_core.ValidationError: 2 validation errors for NASCr...
FAILED tests/oss/test_radius_integration.py::TestRADIUSNASConfiguration::test_list_nas_servers - pydantic_core._pydantic_core.ValidationError: 3 validation errors for NASCr...
FAILED tests/oss/test_radius_integration.py::TestRADIUSUsageMonitoring::test_get_subscriber_usage - AttributeError: 'RADIUSService' object has no attribute 'start_session'
FAILED tests/oss/test_radius_integration.py::TestRADIUSUsageMonitoring::test_get_tenant_usage_summary - AttributeError: 'RADIUSService' object has no attribute 'start_session'
FAILED tests/oss/test_radius_integration.py::TestRADIUSIntegrationWithLifecycle::test_provision_service_creates_radius_subscriber - AttributeError: 'RADIUSService' object has no attribute 'get_subscriber_by_...
FAILED tests/oss/test_radius_integration.py::TestRADIUSIntegrationWithLifecycle::test_suspend_service_suspends_radius_access - AttributeError: 'RADIUSService' object has no attribute 'suspend_subscriber...
FAILED tests/oss/test_service_lifecycle_automation.py::TestEndToEndServiceProvisioning::test_full_fiber_service_provisioning_workflow - AssertionError: assert <ServiceStatu...IVE: 'active'> == 'provisioning'
FAILED tests/oss/test_service_lifecycle_automation.py::TestEndToEndServiceProvisioning::test_service_provisioning_with_validation_failure - AssertionError: assert <ServiceStatus.ACTIVE: 'active'> in ['failed', 'vali...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceModificationWorkflows::test_upgrade_service_bandwidth - pydantic_core._pydantic_core.ValidationError: 2 validation errors for Servi...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceModificationWorkflows::test_enable_managed_wifi - ImportError: cannot import name 'SetParametersRequest' from 'dotmac.platfor...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceSuspensionWorkflows::test_suspend_service_for_nonpayment - TypeError: LifecycleOrchestrationService.activate_service() got an unexpect...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceSuspensionWorkflows::test_resume_service_after_payment - TypeError: LifecycleOrchestrationService.activate_service() got an unexpect...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceTerminationWorkflows::test_terminate_service_with_full_cleanup - ImportError: cannot import name 'DeviceOperationRequest' from 'dotmac.platf...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceLifecycleHealthChecks::test_automated_health_check_all_services - TypeError: LifecycleOrchestrationService.activate_service() got an unexpect...
FAILED tests/oss/test_service_lifecycle_automation.py::TestServiceLifecycleHealthChecks::test_detect_service_degradation - TypeError: LifecycleOrchestrationService.activate_service() got an unexpect...
FAILED tests/oss/test_service_lifecycle_automation.py::TestBulkServiceOperations::test_bulk_service_suspension - TypeError: LifecycleOrchestrationService.activate_service() got an unexpect...
FAILED tests/plugins/test_router_endpoints.py::TestPluginRouterEndpoints::test_bulk_health_check_with_error - NameError: name 'UTC' is not defined
FAILED tests/plugins/test_router_endpoints_real.py::TestErrorHandlingPaths::test_bulk_health_check_with_errors - NameError: name 'UTC' is not defined
FAILED tests/sales/test_api.py::TestPublicOrderAPI::test_create_order_public_success - assert 400 == 201
FAILED tests/sales/test_api.py::TestPublicOrderAPI::test_create_order_public_validation_error - assert 400 == 422
FAILED tests/sales/test_api.py::TestPublicOrderAPI::test_create_quick_order_starter - assert 400 == 201
FAILED tests/sales/test_api.py::TestPublicOrderAPI::test_create_quick_order_professional - assert 400 == 201
FAILED tests/sales/test_api.py::TestPublicOrderAPI::test_get_order_status_public - assert 400 == 200
FAILED tests/sales/test_api.py::TestPublicOrderAPI::test_get_order_status_not_found - assert 400 == 404
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_list_orders - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_list_orders_filter_by_status - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_list_orders_filter_by_email - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_get_order - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_submit_order - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_process_order - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_update_order_status - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_cancel_order - assert 404 == 200
FAILED tests/sales/test_api.py::TestInternalOrderAPI::test_cancel_order_wrong_status - assert 404 == 400
FAILED tests/sales/test_api.py::TestActivationAPI::test_list_order_activations - assert 404 == 200
FAILED tests/sales/test_api.py::TestActivationAPI::test_get_activation_progress - assert 404 == 200
FAILED tests/sales/test_api.py::TestActivationAPI::test_retry_failed_activations - assert 404 == 200
FAILED tests/sales/test_api.py::TestActivationAPI::test_retry_no_failed_activations - assert 404 == 200
FAILED tests/sales/test_api.py::TestOrderStatisticsAPI::test_get_order_statistics - assert 404 == 200
FAILED tests/sales/test_api.py::TestOrderStatisticsAPI::test_statistics_revenue_calculation - assert 404 == 200
FAILED tests/sales/test_api.py::TestOrderStatisticsAPI::test_statistics_success_rate - assert 404 == 200
FAILED tests/sales/test_api.py::TestAPIAuthentication::test_public_api_no_auth_required - assert 400 == 200
FAILED tests/sales/test_api.py::TestAPIAuthentication::test_internal_api_requires_auth - assert 400 in [401, 403]
FAILED tests/sales/test_api.py::TestAPIAuthentication::test_internal_api_with_auth - assert 404 == 200
FAILED tests/sales/test_api.py::TestAPIPagination::test_list_orders_pagination - assert 404 == 200
FAILED tests/sales/test_api.py::TestAPIPagination::test_pagination_limits - assert 404 in [200, 422]
FAILED tests/sales/test_api.py::TestAPIErrorHandling::test_invalid_order_id - assert 404 == 422
FAILED tests/sales/test_api.py::TestAPIErrorHandling::test_invalid_json_body - assert 400 == 422
FAILED tests/sales/test_api.py::TestAPIErrorHandling::test_missing_required_fields - assert 400 == 422
FAILED tests/sales/test_sales_router.py::TestOrderCRUD::test_list_orders_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestOrderCRUD::test_get_order_by_id_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestOrderCRUD::test_get_order_not_found - assert 401 == 404
FAILED tests/sales/test_sales_router.py::TestOrderCRUD::test_delete_order_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestOrderWorkflow::test_submit_order_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestOrderWorkflow::test_process_order_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestOrderWorkflow::test_update_order_status_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestServiceActivations::test_get_service_activations_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestServiceActivations::test_get_activation_progress_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestServiceActivations::test_retry_failed_activations_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestOrderStatistics::test_get_order_statistics_success - assert 401 == 200
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_get_order_requires_read_permission - assert 400 == 403
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_submit_order_requires_submit_permission - assert 400 == 403
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_process_order_requires_process_permission - assert 400 == 403
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_update_order_requires_update_permission - assert 400 == 403
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_delete_order_requires_delete_permission - assert 400 == 403
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_list_orders_requires_read_permission - assert 400 == 403
FAILED tests/sales/test_sales_router.py::TestSalesOrderPermissions::test_search_orders_requires_read_permission - assert 400 == 403
FAILED tests/services/test_celery_tasks.py::TestProvisionSubscriberAsync::test_provision_subscriber_success - TypeError: provision_subscriber_async() got multiple values for argument 't...
FAILED tests/services/test_celery_tasks.py::TestProvisionSubscriberAsync::test_provision_subscriber_uuid_conversion - TypeError: provision_subscriber_async() got multiple values for argument 't...
FAILED tests/services/test_celery_tasks.py::TestProvisionSubscriberAsync::test_provision_subscriber_retry_on_failure - AssertionError: Expected 'retry' to have been called once. Called 0 times.
FAILED tests/services/test_celery_tasks.py::TestProvisionSubscriberAsync::test_provision_subscriber_serialization - TypeError: provision_subscriber_async() got multiple values for argument 't...
FAILED tests/services/test_celery_tasks.py::TestDeprovisionSubscriberAsync::test_deprovision_subscriber_success - TypeError: deprovision_subscriber_async() got multiple values for argument ...
FAILED tests/services/test_celery_tasks.py::TestDeprovisionSubscriberAsync::test_deprovision_subscriber_retry_on_failure - AssertionError: Expected 'retry' to have been called once. Called 0 times.
FAILED tests/services/test_celery_tasks.py::TestConvertLeadToCustomerAsync::test_convert_lead_success - TypeError: convert_lead_to_customer_async() got multiple values for argumen...
FAILED tests/services/test_celery_tasks.py::TestConvertLeadToCustomerAsync::test_convert_lead_uuid_conversion - TypeError: convert_lead_to_customer_async() got multiple values for argumen...
FAILED tests/services/test_celery_tasks.py::TestConvertLeadToCustomerAsync::test_convert_lead_no_retry_on_failure - AssertionError: Regex pattern did not match.
FAILED tests/services/test_celery_tasks.py::TestAsyncSessionHandling::test_session_generator_properly_consumed - TypeError: provision_subscriber_async() got multiple values for argument 't...
FAILED tests/services/test_services_router_comprehensive.py::TestConvertLeadEndpoint::test_convert_lead_success - assert 404 == 200
FAILED tests/services/test_services_router_comprehensive.py::TestConvertLeadEndpoint::test_convert_lead_validation_error - assert 404 == 400
FAILED tests/services/test_services_router_comprehensive.py::TestConvertLeadEndpoint::test_convert_lead_not_found - AssertionError: assert 'not found' in 'Not Found'
FAILED tests/services/test_services_router_comprehensive.py::TestConvertLeadEndpoint::test_convert_lead_invalid_payload - assert 404 == 422
FAILED tests/services/test_services_router_comprehensive.py::TestConvertLeadAsyncEndpoint::test_convert_lead_async_success - assert 404 == 202
FAILED tests/services/test_services_router_comprehensive.py::TestProvisionSubscriberEndpoint::test_provision_subscriber_success - assert 404 == 201
FAILED tests/services/test_services_router_comprehensive.py::TestProvisionSubscriberEndpoint::test_provision_subscriber_with_onu_and_cpe - assert 404 == 201
FAILED tests/services/test_services_router_comprehensive.py::TestProvisionSubscriberEndpoint::test_provision_subscriber_validation_errors - assert 404 == 422
FAILED tests/services/test_services_router_comprehensive.py::TestProvisionSubscriberEndpoint::test_provision_subscriber_customer_not_found - AssertionError: Expected 'rollback' to have been called.
FAILED tests/services/test_services_router_comprehensive.py::TestProvisionSubscriberEndpoint::test_provision_subscriber_duplicate_username - assert 404 == 400
FAILED tests/services/test_services_router_comprehensive.py::TestProvisionSubscriberAsyncEndpoint::test_provision_subscriber_async_success - assert 404 == 202
FAILED tests/services/test_services_router_comprehensive.py::TestDeprovisionSubscriberEndpoint::test_deprovision_subscriber_success - assert 404 == 200
FAILED tests/services/test_services_router_comprehensive.py::TestSuspendSubscriberEndpoint::test_suspend_subscriber_success - assert 404 == 200
FAILED tests/services/test_services_router_comprehensive.py::TestReactivateSubscriberEndpoint::test_reactivate_subscriber_success - assert 404 == 200
FAILED tests/services/test_services_router_comprehensive.py::TestReactivateSubscriberEndpoint::test_reactivate_non_suspended_subscriber - assert 404 == 400
FAILED tests/services/test_services_router_comprehensive.py::TestTransactionRollback::test_convert_lead_rolls_back_on_error - assert 404 == 500
FAILED tests/services/test_services_router_comprehensive.py::TestTransactionRollback::test_provision_subscriber_rolls_back_on_error - assert 404 == 500
FAILED tests/tenant/test_provisioning_router.py::test_schedule_provisioning_job - assert 401 == 201
FAILED tests/tenant/test_provisioning_router.py::test_schedule_provisioning_job_conflict - assert 401 == 409
FAILED tests/tenant/test_provisioning_router.py::test_list_provisioning_jobs - assert 401 == 200
FAILED tests/tenant/test_provisioning_router.py::test_get_provisioning_job - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecordUsageWithBilling::test_record_usage_success - assert 401 == 201
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecordUsageWithBilling::test_record_usage_with_subscription_id - assert 401 == 201
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecordUsageWithBilling::test_record_usage_zero_values - assert 401 == 201
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecordUsageWithBilling::test_record_usage_invalid_tenant - assert 401 == 500
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecordUsageWithBilling::test_record_usage_missing_fields - assert 401 == 422
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestSyncUsageToBilling::test_sync_usage_success - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestSyncUsageToBilling::test_sync_usage_with_subscription_id - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestSyncUsageToBilling::test_sync_usage_no_subscription - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageOverages::test_get_overages_with_overages - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageOverages::test_get_overages_no_overages - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageOverages::test_get_overages_with_date_range - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetBillingPreview::test_get_billing_preview_with_overages - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetBillingPreview::test_get_billing_preview_without_overages - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetBillingPreview::test_get_billing_preview_default_includes_overages - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageBillingStatus::test_get_billing_status_normal - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageBillingStatus::test_get_billing_status_with_exceeded_limits - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageBillingStatus::test_get_billing_status_approaching_limits - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageBillingStatus::test_get_billing_status_usage_percentages - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageBillingStatus::test_get_billing_status_tenant_not_found - assert 401 == 404
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestGetUsageBillingStatus::test_get_billing_status_includes_current_values - assert 401 == 200
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestErrorHandling::test_record_usage_handles_service_error - assert 401 == 500
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecommendationGeneration::test_recommendations_for_api_limit_exceeded - KeyError: 'recommendations'
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecommendationGeneration::test_recommendations_for_storage_limit_exceeded - KeyError: 'recommendations'
FAILED tests/tenant/test_usage_billing_router_comprehensive.py::TestRecommendationGeneration::test_recommendations_for_user_limit_exceeded - KeyError: 'recommendations'
FAILED tests/unit/test_file_storage_metrics.py::test_metrics_iterates_all_batches - AttributeError: 'function' object has no attribute '__wrapped__'
FAILED tests/webhooks/test_webhooks_router.py::test_subscription_requires_tenant - TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'
FAILED tests/wireguard/test_wireguard_service.py::test_create_server_with_encryption_fallback - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create s...
FAILED tests/wireguard/test_wireguard_service.py::test_create_server_with_vault_storage - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create s...
FAILED tests/wireguard/test_wireguard_service.py::test_create_server_falls_back_when_vault_fails - dotmac.platform.wireguard.service.WireGuardServiceError: Failed to create s...
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUD::test_create_workflow_success - assert 401 == 201
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUD::test_create_workflow_validation_error - assert 401 == 422
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUD::test_get_workflow_success - assert 401 == 200
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUD::test_get_workflow_not_found - assert 401 == 404
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUD::test_list_workflows_success - assert 401 == 200
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUD::test_delete_workflow_success - assert 401 == 204
FAILED tests/workflows/test_workflow_router.py::TestWorkflowExecution::test_execute_workflow_by_name_success - assert 401 == 202
FAILED tests/workflows/test_workflow_router.py::TestWorkflowExecution::test_get_execution_success - assert 401 == 200
FAILED tests/workflows/test_workflow_router.py::TestWorkflowExecution::test_list_executions_success - assert 401 == 200
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUDExtended::test_update_workflow_success - assert 401 == 200
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUDExtended::test_delete_workflow_success - assert 401 == 204
FAILED tests/workflows/test_workflow_router.py::TestWorkflowCRUDExtended::test_cancel_execution_success - assert 401 == 204
FAILED tests/workflows/test_workflow_router.py::TestWorkflowStatistics::test_get_workflow_stats_success - assert 401 == 200
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.auth.rbac_read_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.auth.rbac_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.auth.platform_admin_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.access.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.secrets.api:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.analytics.router:analytics_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.file_storage.router:file_storage_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.communications.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.search.router:search_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.data_transfer.router:data_transfer_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.data_import.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.user_management.router:user_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.user_management.team_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.tenant.router:router0]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.tenant.router:router1]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.tenant.onboarding_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.tenant.domain_verification_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.tenant.usage_billing_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.tenant.oss_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.feature_flags.router:feature_flags_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.customer_management.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.customer_portal.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.contacts.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.auth.api_keys_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.webhooks.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.licensing.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.plugins.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.audit.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.metrics.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.realtime.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.rate_limit.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.jobs.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.jobs.scheduler_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.admin.settings.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.catalog.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.subscriptions.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.pricing.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.bank_accounts.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.settings.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.reconciliation_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.dunning.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.licensing.router_framework:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.invoicing.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.invoicing.money_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.payments.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.receipts.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.credit_notes.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.webhooks.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.monitoring.logs_router:logs_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.monitoring.traces_router:traces_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.partner_management.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.partner_management.portal_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.partner_management.revenue_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.ticketing.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.wireless.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.fiber.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.monitoring_metrics_router:logs_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.monitoring_metrics_router:metrics_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.billing.metrics_router:customer_metrics_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.auth.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.communications.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.file_storage.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.analytics.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.auth.api_keys_metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.secrets.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.monitoring.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.workflows.metrics_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.integrations.router:integrations_router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.radius.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.netbox.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.genieacs.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.voltha.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.ansible.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.wireguard.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.crm.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.services.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.services.lifecycle.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.services.internet_plans.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.notifications.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.diagnostics.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.fault_management.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.fault_management.oncall_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.deployment.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.workflows.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_requires_auth[dotmac.platform.sales.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_authenticated_access[dotmac.platform.access.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_authenticated_access[dotmac.platform.customer_portal.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_authenticated_access[dotmac.platform.billing.invoicing.money_router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_authenticated_access[dotmac.platform.services.lifecycle.router:router]
ERROR tests/routers/test_router_smoke_suite.py::TestRouterSmokeTests::test_router_authenticated_access[dotmac.platform.fault_management.oncall_router:router]
ERROR tests/audit/test_audit_router_comprehensive.py::TestUserActivities::test_get_user_activities
ERROR tests/audit/test_audit_router_comprehensive.py::TestUserActivities::test_get_user_activities_with_limit
ERROR tests/audit/test_audit_router_comprehensive.py::TestUserActivities::test_get_user_activities_nonexistent_user
ERROR tests/audit/test_audit_router_comprehensive.py::TestActivitySummary::test_get_activity_summary_default
ERROR tests/audit/test_audit_router_comprehensive.py::TestActivitySummary::test_get_activity_summary_with_days
ERROR tests/audit/test_audit_router_comprehensive.py::TestSingleActivity::test_get_activity_by_id
ERROR tests/audit/test_audit_router_comprehensive.py::TestSingleActivity::test_get_activity_nonexistent_id
ERROR tests/audit/test_audit_router_comprehensive.py::TestSingleActivity::test_get_activity_invalid_uuid
ERROR tests/audit/test_frontend_logs_endpoint.py::TestFrontendLogsEndpoint::test_create_frontend_logs_authenticated
ERROR tests/audit/test_frontend_logs_endpoint.py::TestFrontendLogsEndpoint::test_create_frontend_logs_batched
ERROR tests/audit/test_frontend_logs_endpoint.py::TestFrontendLogsEndpoint::test_frontend_logs_stored_correctly
ERROR tests/audit/test_frontend_logs_endpoint.py::TestFrontendLogsEndpoint::test_frontend_logs_severity_mapping
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningExecution::test_create_execution_success - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningExecution::test_execute_action_email - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningExecution::test_execute_full_campaign_lifecycle - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningExecution::test_cancel_execution - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningExecution::test_record_payment_recovery - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningStatistics::test_get_campaign_stats - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningStatistics::test_get_overall_dunning_stats - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_dunning_integration.py::TestDunningEdgeCases::test_execution_retry_on_failure - sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) NOT NULL constraint...
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_create_campaign_success
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_create_campaign_validation_error
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_create_campaign_unauthorized
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_list_campaigns
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_list_campaigns_filtered_by_active
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_get_campaign
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_get_campaign_not_found
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_update_campaign
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_delete_campaign
ERROR tests/billing/dunning/test_router.py::TestCampaignEndpoints::test_get_campaign_stats
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_start_execution_success
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_start_execution_duplicate_subscription
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_list_executions
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_list_executions_filtered_by_status
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_get_execution
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_cancel_execution
ERROR tests/billing/dunning/test_router.py::TestExecutionEndpoints::test_get_execution_logs
ERROR tests/billing/dunning/test_router.py::TestStatisticsEndpoints::test_get_tenant_stats
ERROR tests/billing/dunning/test_router.py::TestStatisticsEndpoints::test_get_pending_actions
ERROR tests/billing/dunning/test_router.py::TestRateLimiting::test_campaign_creation_rate_limit
ERROR tests/billing/dunning/test_router.py::TestErrorHandling::test_invalid_uuid_format
ERROR tests/billing/dunning/test_router.py::TestErrorHandling::test_missing_required_fields
ERROR tests/billing/dunning/test_router.py::TestErrorHandling::test_negative_outstanding_amount
ERROR tests/crm/test_crm_router.py::TestLeadEndpoints::test_create_lead_success
ERROR tests/crm/test_crm_router.py::TestLeadEndpoints::test_create_lead_missing_required_fields
ERROR tests/crm/test_crm_router.py::TestLeadEndpoints::test_list_leads
ERROR tests/crm/test_crm_router.py::TestLeadEndpoints::test_get_lead_by_id
ERROR tests/crm/test_crm_router.py::TestLeadEndpoints::test_update_lead_status
ERROR tests/crm/test_crm_router.py::TestLeadEndpoints::test_filter_leads_by_status
ERROR tests/crm/test_crm_router.py::TestQuoteEndpoints::test_create_quote
ERROR tests/crm/test_crm_router.py::TestQuoteEndpoints::test_list_quotes
ERROR tests/crm/test_crm_router.py::TestSiteSurveyEndpoints::test_create_site_survey
ERROR tests/crm/test_crm_router.py::TestSiteSurveyEndpoints::test_list_site_surveys
ERROR tests/crm/test_crm_router.py::TestCRMTenantIsolation::test_leads_are_tenant_isolated
ERROR tests/crm/test_crm_router.py::TestCRMTenantIsolation::test_cannot_access_other_tenant_lead
ERROR tests/examples/example_router_test.py::TestContractPatterns::test_response_schema_validation
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_create_fiber_cable
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_list_fiber_cables
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_list_fiber_cables_with_filters
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_get_fiber_cable
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_get_nonexistent_cable
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_update_fiber_cable
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_activate_fiber_cable
ERROR tests/fiber/test_fiber_rest_api.py::TestFiberCableAPI::test_delete_fiber_cable
ERROR tests/fiber/test_fiber_rest_api.py::TestDistributionPointAPI::test_create_distribution_point
ERROR tests/fiber/test_fiber_rest_api.py::TestDistributionPointAPI::test_list_distribution_points
ERROR tests/fiber/test_fiber_rest_api.py::TestDistributionPointAPI::test_get_port_utilization
ERROR tests/fiber/test_fiber_rest_api.py::TestServiceAreaAPI::test_create_service_area
ERROR tests/fiber/test_fiber_rest_api.py::TestServiceAreaAPI::test_list_service_areas
ERROR tests/fiber/test_fiber_rest_api.py::TestServiceAreaAPI::test_get_coverage_statistics
ERROR tests/fiber/test_fiber_rest_api.py::TestHealthMetricsAPI::test_record_health_metric
ERROR tests/fiber/test_fiber_rest_api.py::TestHealthMetricsAPI::test_list_health_metrics
ERROR tests/fiber/test_fiber_rest_api.py::TestHealthMetricsAPI::test_record_otdr_test
ERROR tests/fiber/test_fiber_rest_api.py::TestHealthMetricsAPI::test_list_otdr_tests
ERROR tests/fiber/test_fiber_rest_api.py::TestAnalyticsAPI::test_network_health_summary
ERROR tests/fiber/test_fiber_rest_api.py::TestAnalyticsAPI::test_capacity_planning
ERROR tests/fiber/test_fiber_rest_api.py::TestAnalyticsAPI::test_coverage_summary
ERROR tests/fiber/test_fiber_rest_api.py::TestValidation::test_create_cable_invalid_fiber_count
ERROR tests/fiber/test_fiber_rest_api.py::TestValidation::test_create_cable_duplicate_cable_id
ERROR tests/fiber/test_fiber_rest_api.py::TestValidation::test_unauthorized_access
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1RouterRegistration::test_crm_router_registered
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1RouterRegistration::test_jobs_router_registered
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1RouterRegistration::test_billing_router_registered
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1RouterRegistration::test_dunning_router_registered
ERROR tests/integration/test_bss_phase1_smoke.py::TestCRMSmoke::test_lead_creation_workflow
ERROR tests/integration/test_bss_phase1_smoke.py::TestCRMSmoke::test_list_leads
ERROR tests/integration/test_bss_phase1_smoke.py::TestCRMSmoke::test_list_quotes
ERROR tests/integration/test_bss_phase1_smoke.py::TestCRMSmoke::test_list_site_surveys
ERROR tests/integration/test_bss_phase1_smoke.py::TestJobsSmoke::test_job_creation_workflow
ERROR tests/integration/test_bss_phase1_smoke.py::TestJobsSmoke::test_list_jobs
ERROR tests/integration/test_bss_phase1_smoke.py::TestJobsSmoke::test_job_statistics
ERROR tests/integration/test_bss_phase1_smoke.py::TestBillingSmoke::test_list_invoices
ERROR tests/integration/test_bss_phase1_smoke.py::TestBillingSmoke::test_list_payments
ERROR tests/integration/test_bss_phase1_smoke.py::TestBillingSmoke::test_list_subscriptions
ERROR tests/integration/test_bss_phase1_smoke.py::TestBillingSmoke::test_get_catalog
ERROR tests/integration/test_bss_phase1_smoke.py::TestDunningSmoke::test_dunning_campaign_creation_workflow
ERROR tests/integration/test_bss_phase1_smoke.py::TestDunningSmoke::test_list_campaigns
ERROR tests/integration/test_bss_phase1_smoke.py::TestDunningSmoke::test_dunning_statistics
ERROR tests/integration/test_bss_phase1_smoke.py::TestDunningSmoke::test_list_executions
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1Integration::test_lead_to_customer_workflow
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1Integration::test_job_tracking_workflow
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1Acceptance::test_all_required_endpoints_available
ERROR tests/integration/test_bss_phase1_smoke.py::TestBSSPhase1Acceptance::test_api_documentation_includes_bss_phase1
ERROR tests/integration/test_cross_module_dependencies.py::TestAuthTenantIntegration::test_auth_with_tenant_context
ERROR tests/integration/test_cross_module_dependencies.py::TestAuthTenantIntegration::test_jwt_service_with_tenant_claims
ERROR tests/integration/test_cross_module_dependencies.py::TestDataTransferStorageIntegration::test_data_transfer_with_file_storage
ERROR tests/integration/test_cross_module_dependencies.py::TestDataTransferStorageIntegration::test_export_to_storage_integration
ERROR tests/integration/test_cross_module_dependencies.py::TestEndToEndIntegration::test_user_authentication_flow
ERROR tests/integration/test_cross_module_dependencies.py::TestEndToEndIntegration::test_data_processing_workflow
ERROR tests/integration/test_module_interfaces.py::TestCrossModuleDataFlow::test_user_data_flow
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_create_job_success
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_create_job_missing_required_fields
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_list_jobs
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_get_job_by_id
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_update_job_progress
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_cancel_job
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_filter_jobs_by_status
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_filter_jobs_by_type
ERROR tests/jobs/test_jobs_router.py::TestJobEndpoints::test_get_job_statistics
ERROR tests/jobs/test_jobs_router.py::TestJobTenantIsolation::test_jobs_are_tenant_isolated
ERROR tests/jobs/test_jobs_router.py::TestJobTenantIsolation::test_cannot_access_other_tenant_job
ERROR tests/network_monitoring/test_network_monitoring_api_integration.py::test_network_overview_api_integration
ERROR tests/webhooks/test_webhooks_router.py::test_create_and_list_subscriptions - TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'
ERROR tests/webhooks/test_webhooks_router.py::test_get_update_and_delete_subscription - TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'
ERROR tests/webhooks/test_webhooks_router.py::test_rotate_secret_changes_value - TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'
ERROR tests/webhooks/test_webhooks_router.py::test_list_deliveries_for_subscription - TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'
ERROR tests/webhooks/test_webhooks_router.py::test_recent_deliveries_endpoint - TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'
= 584 failed, 8613 passed, 416 skipped, 1654 warnings, 219 errors in 3958.90s (1:05:58) =
michaelayoade@macboos-MacBook-Pro dotmac-ftth-ops % 
