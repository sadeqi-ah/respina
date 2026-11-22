from django.contrib import admin

from .models import Service, ServiceStatusLog


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "customer", "service_type", "status", "created_at")
    list_filter = ("status", "service_type")
    search_fields = ("name", "customer__email")
    raw_id_fields = ("customer",)
    # Status changes must go through the audited use case, not a raw admin edit.
    readonly_fields = ("status", "created_at", "updated_at")


@admin.register(ServiceStatusLog)
class ServiceStatusLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "service",
        "from_status",
        "to_status",
        "source",
        "changed_by",
        "created_at",
    )
    list_filter = ("source", "to_status")

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
