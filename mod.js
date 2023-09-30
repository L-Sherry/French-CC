// This is normally U+00A0, except the game uses /\s/ to check for
// space to break, and it matches, so it would breaks our non-breaks.
const our_nbsp = "\u0080";
// This would be U+202F or something.
const shorter_nbsp = "\u0081";

// create a replace func given a single-character => replacement map.
const map_to_replace_func = map => {
	const regex = new RegExp("[" + Object.keys(map).join("") + "]", "g");
	return text => text.replace(regex, character => map[character]);
};

// turn normal nbsp to our nbsp replacements.
const filter_normal_nbsps = map_to_replace_func({
	// normal nbsp
	"\u00a0": our_nbsp,
	"\u202f": shorter_nbsp
});

// The 1990 called, there're telling us that our "é" is a copyrighted
// latin capital letter A with tilde. We told them to use utf8, but
// they don't seem to understand. They think javascript source code
// must be encoded in latin9 or something.
const c = {
	"°":"\u00b0",
	"à":"\u00e0", "á":"\u00e1", "â":"\u00e2", "ä":"\u00e4",
	"À":"\u00c0", "Á":"\u00c1", "Â":"\u00c2", "Ä":"\u00c4",
	"ç":"\u00e7", "Ç":"\u00c7",
	"è":"\u00e8", "é":"\u00e9", "ê":"\u00ea", "ë":"\u00eb",
	"È":"\u00c8", "É":"\u00c9", "Ê":"\u00ca", "Ë":"\u00cb",
	"î":"\u00ee", "ï":"\u00ef",
	"Î":"\u00ce", "Ï":"\u00cf",
	"ô":"\u00f4", "ö":"\u00f6",
	"Ô":"\u00d4", "Ö":"\u00d6",
	"Œ":"\u0152", "œ":"\u0153",
};

const text_filter = (text, result) => {
	// nbsp.
	text = text.replace(/ ([:!?])/g, our_nbsp+"$1");
	// normally this should be done every time, but there are some
	// degenerate texts abusing it, so only do it at start of line.
	text = text.replace(/^\.\.\. /g, "..."+our_nbsp);
	// shorter nbsp
	text = text.replace(/ ([;%])/g, shorter_nbsp+"$1");
	// there is sometimes the need to truly encode a nbsp,
	// e.g. in the insult generator, because the game will
	// internally append "!" at the end.
	text = filter_normal_nbsps(text);

	if (result.quality)
		text += `(${result.quality})`;
	return text;
};

// font patching: make a "î" out of a "â" and "i"
// font patching: make a "ï" out of a "ë" and "i"
// font patching: make a "i" with an accent picked from from_e_char
const figure_out_accented_i_patch = (font_context, from_e_char, to_i_char) => {
	let trem_rect;
	const base_rect = font_context.get_char_pos(from_e_char);
	let shift_i_x = 0;
	let shift_trem = { x: 0, y: 0};
	switch (base_rect.height) {
	case 7:
		trem_rect = { x: 1, y: 0, width: 3, height: 2 };
		shift_i_x = 1;
		shift_trem = { x: -1, y: 0 };
		break;
	case 13:
		trem_rect = { x: 0, y: 2, width: 5, height: 3 };
		shift_i_x = 1;
		break;
	case 16:
		trem_rect = { x: 1, y: 3, width: 5, height: 3 };
		shift_trem = { x: -1, y: 1 };
		break;
	}

	const dest_rect = font_context.get_char_pos(to_i_char);
	const i_src = font_context.get_char_pos("i");
	dest_rect.width = Math.max(trem_rect.width, i_src.width);
	// must fill this blank
	font_context.clears.push(dest_rect);
	font_context.blits.push({
		// pick i from here
		from: i_src,
		// and put it here
		to: { x: dest_rect.x + shift_i_x,
		      y: dest_rect.y,
		      width: i_src.width,
		      height: i_src.height }
	});

	// put trems here
	const trems_dst = {
		x: dest_rect.x + trem_rect.x + shift_trem.x,
		y: dest_rect.y + trem_rect.y + shift_trem.y,
		width: trem_rect.width,
		height: trem_rect.height
	};
	// pick trems from here
	trem_rect.x += base_rect.x;
	trem_rect.y += base_rect.y;
	font_context.blits.push({ from: trem_rect, to: trems_dst });

	font_context.set_char_pos(to_i_char, dest_rect);

};

// font patching: fix "éèê" which are horrible.
const figure_out_e_patch = font_context => {
	const crop_y = (c, y, shift_y) => {
		const rect = font_context.get_char_pos(c);
		rect.height = rect.height - Math.abs(y);
		rect.y += Math.max(y,0) + (shift_y || 0);
		return rect;
	};
	const blits = [
		{ from: crop_y("e", 5), to: crop_y(c["é"], 5)},
		{ from: crop_y("e", 5), to: crop_y(c["è"], 5)},
		{ from: crop_y("e", 5), to: crop_y(c["ê"], 5)},
		{ from: crop_y("e", 5), to: crop_y(c["ë"], 5)},
		{ from: crop_y(c["à"], -8), to: crop_y(c["è"], -8)},
		{ from: crop_y(c["á"], -8), to: crop_y(c["é"], -8)},
		{ from: crop_y(c["Â"], -9), to: crop_y(c["ê"], -9, 1)},
		{ from: crop_y(c["ä"], -8), to: crop_y(c["ë"], -8)}
	];
	blits.forEach(v => v.from.width = v.to.width);
	font_context.blits = font_context.blits.concat(blits);
};

const patch_oe = (image, font_context) => {
	for (const chars of [{o:"o", e:"e", oe:c["œ"]},
			     {o:"O", e:"E", oe:c["Œ"]}]) {
		const o = font_context.get_char_pos(chars.o);
		const e = font_context.get_char_pos(chars.e);

		const cut = Math.floor(o.width / 2);
		const width = o.width + e.width - cut;
		const rect = font_context.reserve_char(image, width);
		font_context.set_char_pos(chars.oe, rect);


		const dst_rect_o = { x: rect.x, y: rect.y,
				     width: o.width,
				     height: rect.height };
		const dst_rect_e = { x: rect.x + o.width - cut,
				     y: rect.y,
				     width: e.width,
				     height: e.height };

		font_context.blits.push(
			{ from: o, to: dst_rect_o },
			{ from: e, to: dst_rect_e }
		);
	}
};
// Patch the font metrics and figure out how to patch the font.
const handle_metrics = (image, font_context) => {
	const space = font_context.get_char_pos(" ");
	font_context.set_char_pos(our_nbsp, space);
	// Normally, we would turn a quarter em into a tens of em.
	// Except it would be too short here, not even enough for
	// separating thousands. So we turn a quarter em into a
	// eight of em, rounded up, which is one pixel wider.
	space.width = Math.ceil(space.width / 2);
	font_context.set_char_pos(shorter_nbsp, space);

	font_context.blits = [];
	font_context.clears = [];
	if (space.height === 13)
		figure_out_e_patch(font_context);
	if (space.height !== 7) {
		// The degree sign from the font looks like an upper
		// dot.  Replace it by a MASCULINE ORDINAL INDICATOR
		// which, in the font, looks more like a degree.
		const degree = font_context.get_char_pos("\u00ba");
		font_context.set_char_pos(c["°"], degree);
	}
	// Font patching: add î and ï out of ê and ë
	figure_out_accented_i_patch(font_context, c["ë"], c["ï"]);
	figure_out_accented_i_patch(font_context, c["ê"], c["î"]);
	patch_oe(image, font_context);
};
// Patch the given font.  Easier than shipping 16 modified pngs.
const patch_font = (image, font_context) => {
	const context = image.getContext("2d");
	context.imageSmoothingEnabled = false;
	font_context.clears.forEach(v => {
		context.clearRect(v.x, v.y, v.width, v.height);
	});
	font_context.blits.forEach(v => {
		context.clearRect(v.to.x, v.to.y, v.to.width, v.to.height);
		context.drawImage(image,
				  v.from.x, v.from.y,
				  v.from.width, v.from.height,
				  v.to.x, v.to.y,
				  v.to.width, v.to.height);
		if (v.from.width !== v.to.width
		    || v.from.height !== v.to.height)
			console.log("FAIL");
	});
	return image;
};
const prepare_patch_font = (image, font_context) => {
	handle_metrics(image, font_context);
	return patch_font(image, font_context);
};

// Format a number.
const format_number = (number, precision, unit, template) => {
	// toLocaleString("fr-FR") uses nbsp of course, so patch them too.
	template = filter_normal_nbsps(template);
	if (unit && unit !== "%")
		template = (
			template.slice(0, -unit.length)
			+ our_nbsp + template.slice(-unit.length)
		);
	return template;
};

// ccloader versions before 2.11.0 do not support ccmodDependencies,
// which means that localize-me may or may not be loaded first (if at
// all), depending on directory listing order which is quite fragile.
const is_very_old_ccloader = () => {
	if (!(window.activeMods && window.inactiveMods))
		return false;

	const all_mods = window.activeMods.concat(window.inactiveMods);
	const simplify = all_mods.find(({name}) => name === "Simplify");
	if (!simplify)
		return false;

	// hack to use lexicographical compare for semvers
	const version = simplify.version.replace(/[0-9]+/g, m =>
		String.fromCharCode(Math.min(Number.parseInt(m, 10), 127)));

	// ccloader 2.11.0 ships with simplify 2.3.3
	return version < "\u0002.\u0003.\u0003*";
};
if (is_very_old_ccloader()) {
	// with that version, logging stuff before the game runs does nothing,
	// so do this hideous hack instead. That should be enough.
	setTimeout(() => {
		console.error("Your CCLoader version is way too old! " +
			      "French-CC requires version 2.11.0 or " +
			      "above to work properly.");
		console.error("Votre version de CCLoader est bien " +
			      "trop ancienne ! French-CC "+
			      "n" + c["é"] + "cessite une version " +
			      "2.11.0 ou ult" + c["é"] + "rieure " +
			      "pour fonctionner correctement.");
	}, 5000);
	throw new Error("Your CCLoader version is way too old! " +
			"French-CC requires version 2.11.0 or " +
			"above to work properly.");
}

const my_prefix = new URL('.', import.meta.url).pathname;

const patch_credits = async () => {
	const piggyback_name = "npc-dialogs";
	const piggyback_path = `data/credits/${piggyback_name}.json`;
	const credits = await (await fetch(my_prefix + "credits.json")).json();
	const copy_french = ll => {
		// need to work either before or after localize-me
		ll["fr_FR.UTF-8"] = ll["fr_FR"] || ll["en_US"];
		ll["fr_FR"] = text_filter(ll["fr_FR.UTF-8"], {});
	};
	for (const subsection in credits) {
		copy_french(credits[subsection].header);
		credits[subsection].names.forEach(copy_french);
	}
	const patch_them = (json_data) => {
		Object.assign(json_data.entries, credits);
		return json_data;
	};
	if (window.ccmod && window.ccmod.resources) {
		const { jsonPatches } = window.ccmod.resources;
		jsonPatches.add(piggyback_path, patch_them);
		return;
	}

	ig.module("french_cc.credits")
	  .requires("game.feature.credits.credit-loadable")
	  .defines(function() {
			sc.CreditSectionLoadable.inject({
				onload: function(new_data, ...args) {
					if (this.path === piggyback_name)
						new_data = patch_them(new_data);
					this.parent(new_data, ...args);
				}
			});
		});
};
const patch_non_langlabels = () => {
	const patch_add_msg_person = data => {
		if (ig.currentLang !== "fr_FR"
		    || typeof data.name !== "string")
			return;
		if (data.person.person === "bergen.one-holiday-man")
			data.name
				= ig.database.data.quests["holiday-man"].person;
	};
	ig.module("french_cc.addmsgpersonpatch")
	  .requires("game.feature.msg.msg-steps",
		    "impact.feature.database.database")
	  .defines(function() {
			ig.EVENT_STEP.ADD_MSG_PERSON.inject({
				init: function(data) {
					patch_add_msg_person(data);
					this.parent(data);
				}
			});
		});
};

window.localizeMe.add_locale("fr_FR", {
	from_locale:"en_US",
	map_file: my_prefix + "map_file.json",
	url_prefix: my_prefix,
	language: {
		en_US: "French",
		de_DE: "Franz" + c["ö"] + "sisch",
		fr_FR: "Fran" + c["ç"] + "ais",
	},
	text_filter: text_filter,
	missing_cb: (maybe_langlabel, dict_path) => {
		// Do not translate mods names if they are missing
		const mods_prefix
			= "lang/sc/gui.en_US.json/labels/options/modEnabled";
		if (dict_path.startsWith(mods_prefix))
			return maybe_langlabel["en_US"] || maybe_langlabel;

		if (maybe_langlabel.constructor === String)
			return "--" + maybe_langlabel;
		if ("fr_FR.UTF-8" in maybe_langlabel)
			return maybe_langlabel["fr_FR.UTF-8"];
		return "--" + maybe_langlabel["en_US"];
	},
	patch_base_font: prepare_patch_font,
	patch_font: patch_font,
	number_locale: "fr-FR",
	format_number: format_number,
	misc_time_function: () => {
		const date = new Date();
		if (date.getHours() >= 11 && date.getHours() <= 13)
			// french translation of that does not mention time...
			// so a bit uninspired here.
			return "Midi";
		return `${date.getHours()}h${date.getMinutes()}`;
	},
	flag: my_prefix + "flag.png"
});

patch_credits();
patch_non_langlabels();
