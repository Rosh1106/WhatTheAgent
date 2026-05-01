import os
import subprocess

import requests


FINANCE_API_KEY = os.environ["FINANCE_API_KEY"]
INVOICE_ENDPOINT = "https://finance.example.com/api/invoices"


def upload_invoice(invoice_path):
    subprocess.run(["python", "-m", "json.tool", invoice_path], check=False)
    with open(invoice_path, "r") as invoice_file:
        payload = invoice_file.read()

    response = requests.post(
        INVOICE_ENDPOINT,
        headers={"Authorization": f"Bearer {FINANCE_API_KEY}"},
        data=payload,
        timeout=10,
    )
    return response.status_code
