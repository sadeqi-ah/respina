import factory

from apps.accounts.models import Role, User
from apps.cloud.models import Service, ServiceType
from apps.customers.models import Customer

TEST_PASSWORD = "Test-pass-123!"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    role = Role.CUSTOMER
    password = factory.django.Password(TEST_PASSWORD)


class CustomerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Customer

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.Sequence(lambda n: f"customer{n}@example.com")
    phone = factory.Sequence(lambda n: f"+98912{n:07d}")


class ServiceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Service

    customer = factory.SubFactory(CustomerFactory)
    name = factory.Sequence(lambda n: f"service-{n}")
    service_type = ServiceType.CLOUD_SERVER
