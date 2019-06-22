

# input
langfiles = translation/*fr_FR.json
langfiles_patches = translation/*fr_FR.json.patch
langdir = translation
bigpack = translation/french_translation
mapfile = map_file.json

# intermediate
stamp = translation/.stamp
clear_packs = translation/clear-packs

# output
encrapted_packs = packs

update: $(stamp)

# define your gamedir here
-include translation/config.mk

PACKFILE=./tools/packfile.py --map-file='$(mapfile)' --from-locale='en_US' \
				--game-dir=$(gamedir)

difflangs: $(langfiles) $(mapfile)
	# handle the various manually translated langfiles
	for langfile in $(langfiles); do \
		filename="$${langfile#'$(langdir)/'}"; \
		basename="$${filename%%.*}"; \
		$(PACKFILE) difflang \
			--file-path="lang/sc/$$basename.en_US.json" \
			$(gamedir)/assets/data/lang/sc/$$basename.en_US.json \
			"$$langfile" \
			"$$langfile.pack" || exit; \
		$(PACKFILE) split -p 1 "$$langfile.pack" '$(clear_packs)' || exit; \
	done


$(stamp): $(bigpack) $(mapfile)
	# handle bigpack
	$(PACKFILE) split -p 1 '$(bigpack)' '$(clear_packs)'
	$(PACKFILE) encrapt '$(clear_packs)' '$(encrapted_packs)'
	touch '$(stamp)'

generate:
	mkdir -p "$(clear_packs)"
	$(PACKFILE) decrapt '$(encrapted_packs)' '$(clear_packs)'
	$(PACKFILE) merge '$(clear_packs)' '$(bigpack)'
