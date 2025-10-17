openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout mysnakagent.key \
  -out mysnakagent.crt \
  -subj "/CN=mysnakagent.com" \
  -addext "subjectAltName=DNS:mysnakagent.com,DNS:auth.mysnakagent.com,IP:127.0.0.1"
