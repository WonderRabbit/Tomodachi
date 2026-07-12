# Local seed auth credentials

Tomodachi stores seeded user passwords as BCrypt hashes in the database. The plaintext below is documented only so local MVP users can log in during development and QA.

Do not reuse these credentials for production or shared environments.

| Email | Initial plaintext password | Role |
| --- | --- | --- |
| `admin@tomodachi.local` | `password` | `ADMIN` |
| `engineer@tomodachi.local` | `password` | `ENGINEER` |
| `viewer@tomodachi.local` | `password` | `VIEWER` |
| `agent@tomodachi.local` | `password` | `AGENT_SERVICE` |
