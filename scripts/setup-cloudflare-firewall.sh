#!/bin/bash
# Setup firewall rules to only allow Cloudflare IPs (HTTP/HTTPS)

# Fetch Cloudflare IPs
echo "Fetching Cloudflare IPv4 ranges..."
IPV4_URL="https://www.cloudflare.com/ips-v4"
IPV4_RANGES=$(curl -s $IPV4_URL)

echo "Fetching Cloudflare IPv6 ranges..."
IPV6_URL="https://www.cloudflare.com/ips-v6"
IPV6_RANGES=$(curl -s $IPV6_URL)

if [ -z "$IPV4_RANGES" ]; then
  echo "Error fetching IPv4 ranges."
  exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  echo "UFW detected. Applying rules via UFW..."
  
  # Allow Cloudflare IPv4
  for ip in $IPV4_RANGES; do
    ufw allow from $ip to any port 80,443 proto tcp
  done
  
  # Allow Cloudflare IPv6
  for ip in $IPV6_RANGES; do
    ufw allow from $ip to any port 80,443 proto tcp
  done
  
  # Deny all other HTTP/HTTPS traffic
  ufw deny 80/tcp
  ufw deny 443/tcp
  
  ufw reload
  echo "UFW rules applied successfully."

elif command -v iptables >/dev/null 2>&1; then
  echo "iptables detected. Applying rules via iptables..."
  
  # Allow Cloudflare IPv4
  for ip in $IPV4_RANGES; do
    iptables -I INPUT -p tcp -m multiport --dports http,https -s $ip -j ACCEPT
  done
  
  # Allow Cloudflare IPv6 (requires ip6tables)
  if command -v ip6tables >/dev/null 2>&1; then
    for ip in $IPV6_RANGES; do
      ip6tables -I INPUT -p tcp -m multiport --dports http,https -s $ip -j ACCEPT
    done
  else
    echo "ip6tables not found, skipping IPv6 rules."
  fi
  
  # Drop all other HTTP/HTTPS traffic (IPv4)
  iptables -A INPUT -p tcp -m multiport --dports http,https -j DROP
  
  # Drop all other HTTP/HTTPS traffic (IPv6)
  if command -v ip6tables >/dev/null 2>&1; then
    ip6tables -A INPUT -p tcp -m multiport --dports http,https -j DROP
  fi
  
  echo "iptables rules applied successfully. Remember to save them (e.g., using iptables-save or netfilter-persistent)."
else
  echo "Neither UFW nor iptables found. Please configure your firewall manually."
  exit 1
fi
