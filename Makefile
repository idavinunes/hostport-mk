SHELL := /bin/bash

.PHONY: up down build logs ps init-env

init-env:
	cp -n .env.example .env || true

build:
	docker compose build

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

