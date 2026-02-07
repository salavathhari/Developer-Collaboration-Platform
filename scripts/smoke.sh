#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:5000}
EMAIL=${EMAIL:-smoke_$(date +%s)@example.com}
PASSWORD=${PASSWORD:-Password123}

register=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke User\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

token=$(echo "$register" | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo "Registered: $EMAIL"

projects=$(curl -s -X GET "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $token")

echo "Projects response: $projects"

created=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Project","description":"Seeded by smoke script"}')

echo "Project created: $created"
