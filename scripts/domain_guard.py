"""Read-only DNS and HTTPS readiness probe for SauceApproved."""
import json
import socket
import ssl
import urllib.request

DOMAIN = 'sauceapproved.com'

def check():
    result = {'domain': DOMAIN, 'addresses': [], 'https_ok': False}
    try:
        result['addresses'] = sorted({item[4][0] for item in socket.getaddrinfo(DOMAIN, 443, family=socket.AF_INET)})
    except OSError as error:
        result['dns_error'] = str(error)
    try:
        with urllib.request.urlopen('https://' + DOMAIN, timeout=8, context=ssl.create_default_context()) as response:
            result['https_ok'] = response.status < 400
    except Exception as error:
        result['https_error'] = str(error)
    result['note'] = 'Does not verify Shopify primary domain, registrar authorization, or payments.'
    return result

if __name__ == '__main__':
    print(json.dumps(check(), indent=2))
