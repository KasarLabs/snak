ENV_FILE=keycloak/.env.keycloak
REALM_TEMPLATE=keycloak/realm-template.json
REALM_OUTPUT=keycloak/realm.json

all: certs realms up

certs:
	@cd keycloak/traefik/certs && \
	./certs.sh
	@printf "%b\n" "→ Ensuring hosts entries"
	@grep -q "mysnakagent.com" /etc/hosts || \
		echo "127.0.0.1 mysnakagent.com auth.mysnakagent.com" | sudo tee -a /etc/hosts >/dev/null
	@printf "%b\n" "✔ Hosts updated"
	@printf "%b\n" "→ /etc/hosts content:"
	@cat /etc/hosts

up:
	@printf "%b\n" "$(_BLUE)→ Starting snak + keycloak stack$(_NO)"
	@docker compose up -d
	@printf "%b\n" "$(_GREEN)✔ Snak + Keycloak running$(_NO)"

realms: 
	@printf "%b\n" "$(_STARLIGHT_BLUE)→ Generating realm.json from template$(_NO)"
	@export $$(grep -v '^#' $(ENV_FILE) | xargs) && \
	envsubst < $(REALM_TEMPLATE) > $(REALM_OUTPUT)
	@printf "%b\n" "$(_GREEN)✔ Realm file generated: $(REALM_OUTPUT)$(_NO)"

down:
	@printf "%b\n" "$(_STARLIGHT_BLUE)→ Stopping all stacks$(_NO)"
	@docker compose down
	@printf "%b\n" "$(_GREEN)✔ All stacks stopped$(_NO)"

clean:
	@printf "%b\n" "$(_STARLIGHT_BLUE)→ Cleaning all (stacks + realm.json)$(_NO)"
	@docker compose down -v
	@docker volume prune -af
	@docker system prune -af
	rm -f $(REALM_OUTPUT)
	rm -f keycloak/traefik/certs/mysnakagent.crt
	rm -f keycloak/traefik/certs/mysnakagent.key
	@printf "%b\n" "$(_GREEN)✔ Clean done$(_NO)"

.PHONY: all certs up realms down clean

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
