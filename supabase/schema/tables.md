| table_name            | column_name               | data_type                | is_nullable |
| --------------------- | ------------------------- | ------------------------ | ----------- |
| appointments          | id                        | uuid                     | NO          |
| appointments          | organization_id           | uuid                     | NO          |
| appointments          | customer_id               | uuid                     | YES         |
| appointments          | service_id                | uuid                     | YES         |
| appointments          | profile_id                | uuid                     | YES         |
| appointments          | start_time                | timestamp with time zone | NO          |
| appointments          | end_time                  | timestamp with time zone | NO          |
| appointments          | status                    | text                     | YES         |
| appointments          | price                     | numeric                  | YES         |
| appointments          | notes                     | text                     | YES         |
| appointments          | created_at                | timestamp with time zone | YES         |
| appointments          | professional_id           | uuid                     | YES         |
| customers             | id                        | uuid                     | NO          |
| customers             | organization_id           | uuid                     | NO          |
| customers             | name                      | text                     | NO          |
| customers             | phone                     | text                     | NO          |
| customers             | email                     | text                     | YES         |
| customers             | document                  | text                     | YES         |
| customers             | notes                     | text                     | YES         |
| customers             | created_at                | timestamp with time zone | YES         |
| customers             | updated_at                | timestamp with time zone | YES         |
| customers             | gender                    | text                     | YES         |
| customers             | active                    | boolean                  | YES         |
| customers             | address                   | text                     | YES         |
| customers             | birth_date                | date                     | YES         |
| invitations           | id                        | uuid                     | NO          |
| invitations           | organization_id           | uuid                     | NO          |
| invitations           | code                      | text                     | NO          |
| invitations           | role                      | text                     | NO          |
| invitations           | created_at                | timestamp with time zone | NO          |
| invitations           | expires_at                | timestamp with time zone | NO          |
| invitations           | used_count                | integer                  | YES         |
| medical_records       | id                        | uuid                     | NO          |
| medical_records       | organization_id           | uuid                     | NO          |
| medical_records       | customer_id               | uuid                     | NO          |
| medical_records       | professional_id           | uuid                     | YES         |
| medical_records       | content                   | text                     | NO          |
| medical_records       | status                    | USER-DEFINED             | YES         |
| medical_records       | signed_at                 | timestamp with time zone | YES         |
| medical_records       | signed_by                 | uuid                     | YES         |
| medical_records       | created_at                | timestamp with time zone | YES         |
| medical_records       | updated_at                | timestamp with time zone | YES         |
| organization_settings | organization_id           | uuid                     | NO          |
| organization_settings | open_hours_start          | time without time zone   | YES         |
| organization_settings | open_hours_end            | time without time zone   | YES         |
| organization_settings | appointment_duration      | integer                  | YES         |
| organization_settings | days_of_week              | ARRAY                    | YES         |
| organization_settings | msg_appointment_created  | text                     | YES         |
| organization_settings | msg_appointment_reminder | text                     | YES         |
| organization_settings | msg_appointment_canceled | text                     | YES         |
| organization_settings | created_at                | timestamp with time zone | YES         |
| organization_settings | updated_at                | timestamp with time zone | YES         |
| organizations         | id                        | uuid                     | NO          |
| organizations         | created_at                | timestamp with time zone | YES         |
| organizations         | name                      | text                     | NO          |
| organizations         | slug                      | text                     | NO          |
| organizations         | document                  | text                     | YES         |
| organizations         | evolution_instance_name   | text                     | YES         |
| organizations         | evolution_api_key         | text                     | YES         |
| organizations         | evolution_api_url         | text                     | YES         |
| organizations         | subscription_status       | text                     | YES         |
| organizations         | stripe_customer_id        | text                     | YES         |
| organizations         | whatsapp_config           | jsonb                    | YES         |
| organizations         | address                   | text                     | YES         |
| organizations         | phone                     | text                     | YES         |
| organizations         | email                     | text                     | YES         |
| organizations         | onboarding_completed      | boolean                  | YES         |
| organizations         | niche                     | text                     | YES         |
| organizations         | status                    | text                     | NO          |
| organizations         | plan                      | text                     | NO          |
| profiles              | id                        | uuid                     | NO          |
| profiles              | created_at                | timestamp with time zone | YES         |
| profiles              | organization_id           | uuid                     | YES         |
| profiles              | full_name                 | text                     | YES         |
| profiles              | avatar_url                | text                     | YES         |
| profiles              | role                      | text                     | YES         |
| profiles              | crm                       | text                     | YES         |
| profiles              | email                     | text                     | YES         |
| service_notes         | id                        | uuid                     | NO          |
| service_notes         | organization_id           | uuid                     | NO          |
| service_notes         | customer_id               | uuid                     | YES         |
| service_notes         | profile_id                | uuid                     | YES         |
| service_notes         | title                     | text                     | YES         |
| service_notes         | content                   | text                     | NO          |
| service_notes         | tags                      | ARRAY                    | YES         |
| service_notes         | created_at                | timestamp with time zone | YES         |
| service_notes         | status                    | text                     | YES         |
| service_notes         | signed_at                 | timestamp with time zone | YES         |
| services              | id                        | uuid                     | NO          |
| services              | organization_id           | uuid                     | NO          |
| services              | title                     | text                     | NO          |
| services              | description               | text                     | YES         |
| services              | duration_minutes          | integer                  | NO          |
| services              | price                     | numeric                  | YES         |
| services              | is_active                 | boolean                  | YES         |
| services              | created_at                | timestamp with time zone | YES         |
| services              | color                     | text                     | YES         |
| whatsapp_instances    | id                        | uuid                     | NO          |
| whatsapp_instances    | organization_id           | uuid                     | NO          |
| whatsapp_instances    | name                      | text                     | NO          |