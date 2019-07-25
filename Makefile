# input files
langdir = translation
bigpack = translation/french_translation
mapfile = map_file.json

# intermediate files/directories
stamp = translation/.stamp
clear_packs = translation/clear-packs

# output directory
encrapted_packs = packs

# default action
update: $(stamp)

# define your gamedir here if you are tired from repeating it.
-include translation/config.mk

PACKFILE=gamedir='$(gamedir)'; \
	./tools/packfile.py --map-file='$(mapfile)' --from-locale='en_US' \
				$${gamedir:+"--game-dir=$$gamedir"}

$(stamp): $(bigpack) $(mapfile)
	$(PACKFILE) split -p 1 '$(bigpack)' '$(clear_packs)'
	$(PACKFILE) encrapt '$(clear_packs)' '$(encrapted_packs)'
	touch '$(stamp)'

generate:
	mkdir -p "$(clear_packs)"
	$(PACKFILE) decrapt '$(encrapted_packs)' '$(clear_packs)'
	$(PACKFILE) merge '$(clear_packs)' '$(bigpack)'
