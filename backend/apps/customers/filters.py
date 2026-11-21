import django_filters

from apps.cloud.models import Service, ServiceStatus, ServiceType


class ServiceFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=ServiceStatus.choices)
    service_type = django_filters.ChoiceFilter(choices=ServiceType.choices)

    class Meta:
        model = Service
        fields = ["status", "service_type"]
