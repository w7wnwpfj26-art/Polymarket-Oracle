# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Security Best Practices

### 1. **Never Commit Secrets**
- All API keys, private keys, and passwords must be stored in `.env` or `backend/data/config.json`
- Both files are in `.gitignore` — ensure they stay there
- Use `.env.example` and `config.json.example` as templates

### 2. **Rotate Credentials Regularly**
If you suspect a key has been exposed:
- **OpenAI/Anthropic**: Revoke and regenerate keys in your provider dashboard
- **Polymarket**: Rotate API credentials immediately
- **Wallet Private Keys**: Transfer funds to a new wallet ASAP

### 3. **Use Demo Mode First**
- Set `strategy.execution.dryRunMode: true` in config
- Test all features without real funds
- Only switch to live trading after thorough testing

### 4. **Limit Exposure**
Configure conservative risk limits:
```json
{
  "strategy": {
    "riskManagement": {
      "maxSingleTradeAmount": 100,
      "maxTotalExposure": 1000,
      "maxDailyLoss": 50
    }
  }
}
```

### 5. **Secure Your Environment**
- Run the system on a trusted machine
- Use HTTPS/TLS in production
- Enable authentication (`AUTH_ENABLED=true`)
- Whitelist IPs if possible
- Use strong `JWT_SECRET` and `AEGIS_ADMIN_PASSWORD`

### 6. **Docker Security**
- Don't expose ports publicly without firewall rules
- Use Docker secrets for sensitive env vars in production
- Regularly update base images (`docker-compose pull`)

### 7. **Git History Cleanup**
If you accidentally committed secrets, use tools like:
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- `git filter-branch` (advanced)

Then force-push and rotate all exposed credentials.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Email: [YOUR_SECURITY_EMAIL] or create a private security advisory on GitHub
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within **72 hours** and work with you to address the issue.

## Disclosure Policy

- We follow **coordinated disclosure** principles
- Security fixes will be released as patches
- Credit will be given to reporters (unless anonymity is requested)

## Known Security Considerations

### 1. **Private Key Management**
This system requires private keys for on-chain transactions. Current implementation:
- ⚠️ Stored in plaintext in `config.json` (local deployments only)
- 🔒 Recommended: Use hardware wallets, AWS KMS, or HashiCorp Vault in production

### 2. **AI Model Prompts**
AI agents receive market data and make decisions. Potential risks:
- Prompt injection attacks
- Adversarial market descriptions
- Mitigation: Semantic risk scoring, red team simulator

### 3. **Rate Limiting**
- Default: 200 req/min per IP
- Adjust `RATE_LIMIT_PER_MINUTE` based on your needs
- Use Redis for distributed rate limiting

### 4. **WebSocket Security**
- Currently no authentication on WebSocket endpoint
- Recommended: Add API key or JWT validation for production

### 5. **SQL Injection**
- Using Drizzle ORM with parameterized queries
- No direct SQL construction from user input
- Risk: Low

## Security Checklist for Deployment

- [ ] All secrets in `.env` / `config.json` (not committed)
- [ ] Strong `JWT_SECRET` (32+ random characters)
- [ ] `AUTH_ENABLED=true` in production
- [ ] `dryRunMode: true` initially
- [ ] Conservative risk limits configured
- [ ] HTTPS enabled (via reverse proxy)
- [ ] Firewall rules configured
- [ ] Regular backups of `backend/data/aegis.db`
- [ ] Monitoring & alerting set up
- [ ] Reviewed Polymarket/Kalshi platform ToS

---

**Last Updated**: 2026-02-21  
**Next Review**: 2026-05-21
