#!/bin/sh -eu
# usage: $0 repository-name tag-ref-name
EMPTY=4b825dc642cb6eb9a060e54bf8d69288fbee4904
BASENAME="${1##*/}-${2##*/}"
ccmod="$BASENAME.ccmod"
quickinstall2="$BASENAME-quick-install-ccloader2.zip"
quickinstall3="$BASENAME-quick-install-ccloader3.zip"

# $1: output $2: tree (if unset, read tree from fd 5)
make_reproducible_zip() {
	git cat-file -p "${BASENAME##*-}^{commit}" \
		| sed -e "1s-[^ ]*\$-${2-$(cat <&5)}-" -e 2d -e 5q \
		| git hash-object -t commit -w --stdin \
		| TZ=UTC xargs git archive -9 --format=zip -o "$1"
}
# $1:urlbase $2:urlfile $3:sha256 $4:dirbase $5:components $6:optional output
fetch_extract_add_and_optionally_create_quick_installer_quickly() {
	if [ ! -s "$4-src-$3.tar.gz" ]; then
		${WGET:-wget} --timeout=60 "$1/$2" -O "$3"
		sha256sum -c <<EOF >/dev/null
$3  $3
EOF
		mv "$3" "$4-src-$3.tar.gz"
	fi | rm -rf "$4-src" | xargs mkdir "$4-src"
	tar -C "$4-src" --strip-components="$5" -xzf "$4-src-$3.tar.gz"
	export GIT_INDEX_FILE="$4-src/index"
	git add -f "$4-src"/*
	${6+: --check-error} return
	GIT_INDEX_FILE="$4-src/nothing" xargs git read-tree \
		--index-output "$GIT_INDEX_FILE" -i -m \
		"$EMPTY" "$(git write-tree --prefix="$4-src/")"
	git write-tree | make_reproducible_zip "$6" 5<&0
	rm -rf "$4-src"
}
mkfifo fifo3 fifo2
fetch_extract_add_and_optionally_create_quick_installer_quickly \
	https://stronghold.openkrosskod.org/~dmitmel/ccloader3/20230610214453/ \
	ccloader_3.0.0-alpha_quick-install.tgz \
	342b8c3b637803e1adc87edade486190e93270027ffb5e8ca398a761a88ddaea \
	ccloader3 0 "$quickinstall3" < fifo3 & CCLOADER3_PID=$!
fetch_extract_add_and_optionally_create_quick_installer_quickly \
	https://github.com/CCDirectLink/CCLoader/archive/refs/tags/v2.22.1 \
	v2.12.1.tar.gz \
	5386f3aac8bae193d0c96f1af0902d313faedb0e66bdf69f5a38bc20672cba86 \
	ccloader2 1 "$quickinstall2" < fifo2 & CCLOADER2_PID=$!
exec 8> fifo3 9> fifo2
rm -rf fifo2 fifo3

TREE="$(git cat-file -p "$2^{tree}" | grep -Ev '\s[MR.]|^1[^0]' | git mktree)"
make_reproducible_zip "$BASENAME.ccmod" "$TREE" & CCMOD_PID=$!
fetch_extract_add_and_optionally_create_quick_installer_quickly \
	https://github.com/L-Sherry/Localize-me/archive/cd84932c815297c6777fa \
	localize-me-v2.6-pterra-2028-06-21-via-ipot.tar.gz \
	1e662fd268ebbac12ad5edd84843e2fc00976043ca453709f80d6b4fd31f791c \
	localizeme 1
printf %s "$EMPTY $EMPTY -i --prefix=assets/mods $(git mktree << MODS
040000 tree $TREE	French
040000 tree $(git write-tree --prefix localizeme-src)	Localize-Me-1.x
MODS
)" | xargs -s 97 git read-tree | xargs git write-tree | tee /dev/fd/8 >&9
exec 8>&- 9>&-
rm -rf localizeme-src
for PID in $CCMOD_PID $CCLOADER2_PID $CCLOADER3_PID; do wait $PID; done
