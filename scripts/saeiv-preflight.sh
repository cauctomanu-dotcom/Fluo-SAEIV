#!/usr/bin/env bash
# Pré-vol MonSAEIV — lecture seule, aucune installation/modification.
set -u

section() { printf '\n=== %s ===\n' "$1"; }
section "Identité du serveur"
date -Is
hostname
uname -m
uname -r
if command -v hostnamectl >/dev/null 2>&1; then hostnamectl --static 2>/dev/null || true; fi

section "Capacité"
free -h
df -h /
findmnt -n -o SOURCE,TARGET,FSTYPE,OPTIONS / 2>/dev/null || true
printf "CPU actifs : "; getconf _NPROCESSORS_ONLN

section "Services radio"
for service in icecast2 caddy nginx apache2; do
  printf '%s : ' "$service"
  systemctl is-active "$service" 2>/dev/null || true
done

section "Icecast local"
if command -v curl >/dev/null 2>&1; then
  curl -fsS --max-time 5 http://127.0.0.1:8000/status-json.xsl | python3 -c '
import json, sys
try:
 d=json.load(sys.stdin)["icestats"]
 s=d.get("source")
 if isinstance(s,list): s=s[0] if s else None
 print("Icecast:",d.get("server_id","?"))
 print("Source connectée:","oui" if s else "non")
 if isinstance(s,dict):
  print("Nom:",s.get("server_name","?"))
  print("Auditeurs:",s.get("listeners","?"))
except Exception as e:
 print("Réponse impossible à interpréter:", e)
' || printf 'Échec du contrôle local Icecast\n'
else
  printf 'curl absent\n'
fi

section "Ports en écoute (lecture seule)"
ss -lnt 2>/dev/null || true

section "Logiciels potentiellement utilisables pour MonSAEIV"
for x in node npm python3 sqlite3 psql pg_dump; do
  if command -v "$x" >/dev/null 2>&1; then
    printf '%s : %s\n' "$x" "$(command -v "$x")"
  else
    printf '%s : non installé\n' "$x"
  fi
done

section "Fin du contrôle"
printf 'Aucune modification faite. Ne pas installer de paquets ni toucher à Icecast/Caddy avant analyse.\n'
