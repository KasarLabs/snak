ENV_FILE=.env.keycloak
REALM_TEMPLATE=realm-template.json
REALM_OUTPUT=realm.json

all: certs snak-api keycloak

certs:
	@cd keycloak/traefik/certs && \
	./certs.sh
	@echo "→ Ensuring hosts entries"
	@grep -q "mysnakagent.com" /etc/hosts || \
		echo "127.0.0.1 mysnakagent.com auth.mysnakagent.com" | sudo tee -a /etc/hosts >/dev/null
	@echo "✔ Hosts updated"
	@echo "→ /etc/hosts content:"
	@cat /etc/hosts

snak-api:
	@echo "$(_BLUE)→ Starting Snak stack (root)$(_NO)"
	@docker compose up -d
	@echo "$(_GREEN)✔ Snak stack running$(_NO)"

snak_down:
	@echo "$(_STARLIGHT_BLUE)→ Stopping snak$(_NO)"
	@docker compose down
	@echo "$(_GREEN)✔ Snak stopped$(_NO)"

keycloak:
	@cd keycloak && \
	echo "$(_STARLIGHT_BLUE)→ Generating realm.json from template$(_NO)" && \
	export $$(grep -v '^#' $(ENV_FILE) | xargs) && \
	envsubst < $(REALM_TEMPLATE) > $(REALM_OUTPUT) && \
	echo "$(_GREEN)✔ Realm file generated: $(REALM_OUTPUT)$(_NO)" && \
	echo "$(_BLUE)→ Starting Keycloak stack (keycloak/)$(_NO)" && \
	docker compose up -d && \
	echo "$(_GREEN)✔ Keycloak stack running$(_NO)"

keycloak_down:
	@echo "$(_STARLIGHT_BLUE)→ Stopping keycloak$(_NO)"
	@cd keycloak && \
	docker compose down
	@echo "$(_GREEN)✔ Keycloak stopped$(_NO)"

down:
	@echo "$(_STARLIGHT_BLUE)→ Stopping all stacks$(_NO)"
	@docker compose down
	@cd keycloak && docker compose down
	@echo "$(_GREEN)✔ All stacks stopped$(_NO)"

clean:
	@echo "$(_STARLIGHT_BLUE)→ Cleaning all (stacks + realm.json)$(_NO)"
	@docker compose down -v
	@cd keycloak && docker compose down && docker volume prune -af && docker system prune -af
	rm -f $(REALM_OUTPUT)
	rm keycloak/traefik/certs/mysnakagent.crt
	rm keycloak/traefik/certs/mysnakagent.key
	@echo "$(_GREEN)✔ Clean done$(_NO)"

.PHONY: keycloak snak-api all down clean 

# -------------- Syntaxing -------------- #
_NO                    = \033[0m
_BOLD                  = \033[1m
_BLUE                  = \033[34m
_CYAN                  = \033[36m
_RED                   = \033[31m
_PURPLE                = \033[35m
_PINK_ORANGE           = \033[38;5;215m
_GREY                  = \033[38;5;234m
_STARLIGHT_BLUE        = \033[38;5;158m
_STARLIGHT_GREEN       = \033[38;5;157m
_DEEP_BLUE             = \033[38;5;69m
_YELLOW                = \033[38;5;226m
_ORANGE                = \033[38;5;209m\e[1m
# ------------------------------------- #

