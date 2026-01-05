#!/usr/bin/env python3
"""
Generaliserat script för att hitta site ID från SL Transport API
Användning: python3 find_site_id.py <stationsnamn>
Exempel: python3 find_site_id.py Luma
"""

import json
import urllib.request
import sys

def fetch_sites():
    """Hämtar alla sites från SL Transport API"""
    url = "https://transport.integration.sl.se/v1/sites?expand=true"
    
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        print(f"Fel vid hämtning: {e}")
        return None

def find_station(sites, search_term):
    """Söker efter station i site-listan"""
    matches = []
    search_lower = search_term.lower()
    
    for site in sites:
        name = site.get('name', '').lower()
        if search_lower in name:
            matches.append({
                'id': site['id'],
                'name': site['name'],
                'type': site.get('type', 'N/A')
            })
    
    return matches

def main():
    if len(sys.argv) < 2:
        print("Användning: python3 find_site_id.py <stationsnamn>")
        print("Exempel: python3 find_site_id.py Luma")
        print("         python3 find_site_id.py Slussen")
        sys.exit(1)
    
    search_term = ' '.join(sys.argv[1:])
    
    print(f"Söker efter '{search_term}' i SL Transport API...")
    print("-" * 50)
    
    sites = fetch_sites()
    
    if not sites:
        print("Kunde inte hämta data från API:et.")
        sys.exit(1)
    
    matches = find_station(sites, search_term)
    
    if matches:
        print(f"\n✅ Hittade {len(matches)} matchning(ar) för '{search_term}':\n")
        for i, match in enumerate(matches, 1):
            print(f"{i}. {match['name']}")
            print(f"   Site ID: {match['id']}")
            print(f"   Typ: {match['type']}")
            print()
        
        # Visa config-exempel
        if len(matches) > 0:
            print("─" * 50)
            print("Exempel för config.json:\n")
            for match in matches:
                print(f'  "station": {{')
                print(f'    "siteId": "{match["id"]}",')
                print(f'    "name": "{match["name"]}"')
                print(f'  }}')
                print()
    else:
        print(f"\n❌ Ingen matchning hittades för '{search_term}'.")
        print("\nTips: Prova närliggande stationer:")
        
        nearby = ['slussen', 'gullmarsplan', 'sickla', 't-centralen']
        print()
        for station in nearby:
            nearby_matches = find_station(sites, station)
            if nearby_matches:
                match = nearby_matches[0]
                print(f"  {match['name']}: Site ID {match['id']}")

if __name__ == "__main__":
    main()
