# Rotordyn.ai: Enterprise Documentation Suite Index

This index provides a centralized navigation directory for the Rotordyn.ai technical documentation suite. Refer to the specific manuals below based on your organizational role.

---

## 1. Document Directory (Direct Links)

| Document Name | Code Reference File | Target Audience |
| :--- | :--- | :--- |
| **Software Design Document (SDD)** | [sdd_software_design_document.md](architecture/sdd_software_design_document.md) | CTO, Technical Stakeholders, Solution Architects |
| **Software Architecture Document (SAD)** | [sad_software_architecture_document.md](architecture/sad_software_architecture_document.md) | Systems Architects, Solutions Architects |
| **Developer Guide** | [developer_guide.md](developer/developer_guide.md) | Software Engineers, QA Engineers, Core Maintainers |
| **API Reference** | [api_reference.md](api/api_reference.md) | Developers, Integration Partners |
| **Database Design Guide** | [database_design_guide.md](database/database_design_guide.md) | Database Administrators, Data Architects |
| **Security Architecture Guide** | [security_architecture_guide.md](security/security_architecture_guide.md) | Security Architects, Compliance Auditors |
| **Operations Runbook** | [operations_runbook.md](operations/operations_runbook.md) | SRE Engineers, Network Operations Center (NOC) |
| **Deployment Guide** | [deployment_guide.md](deployment/deployment_guide.md) | SRE/DevOps Engineers, Deployment Managers |
| **Administrator Guide** | [administrator_guide.md](admin/administrator_guide.md) | Workspace Administrators, Operations Managers |
| **User Manual** | [user_manual.md](user/user_manual.md) | Machinery Analysts, Operator Technicians |

---

## 2. Navigation Guide by Role

### For Developers & Maintainers
1. Read the [Developer Guide](developer/developer_guide.md) to set up your local workspace environment.
2. Review the [API Reference](api/api_reference.md) for endpoint parameter configurations.
3. Consult the [Database Design Guide](database/database_design_guide.md) for PostgreSQL schema and Alembic migrations.

### For SRE & DevOps Operations
1. Use the [Deployment Guide](deployment/deployment_guide.md) to build Docker containers and verify HSTS edge proxies.
2. Refer to the [Operations Runbook](operations/operations_runbook.md) for incident mitigation playbooks and Prometheus scraping queries.

### For Security & Compliance Auditors
1. Inspect the [Security Architecture Guide](security/security_architecture_guide.md) to review OWASP Top 10 mitigation tables and Stripe signature checks.
2. Audit system events log tracking configurations inside the database schemas.

### For End-Users & Analysts
1. Follow the [User Manual](user/user_manual.md) to upload CSV telemetry and analyze orbit profiles.
2. Refer to the troubleshooting section for active filter configurations.
