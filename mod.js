(() => {
	var normal_nbsp = '\u00a0';
	var normal_shorter_nbsp = '\u202f';
	// This is normally U+00A0, except the game uses /\s/ to check for
	// space to break, and it matches, so it would breaks our non-breaks.
	var our_nbsp = '\u0080';
	// This would be U+202F or something.
	var shorter_nbsp = '\u0081';

	var nbsp_map = {
		'\u00a0': our_nbsp,
		'\u202f': shorter_nbsp
	};

	// The 1990 called, there're telling us that our 'é' is a copyrighted
	// latin capital letter A with tilde. We told them to use utf8, but
	// they don't seem to understand. They think javascript source code
	// must be encoded in latin9 or something.
	var c = { "à":"\u00e0", "á":"\u00e1", "â":"\u00e2", "ä":"\u00e4",
		  "À":"\u00c0", "Á":"\u00c1", "Â":"\u00c2", "Ä":"\u00c4",
		  "ç":"\u00e7", "Ç":"\u00c7",
		  "è":"\u00e8", "é":"\u00e9", "ê":"\u00ea", "ë":"\u00eb",
		  "È":"\u00c8", "É":"\u00c9", "Ê":"\u00ca", "Ë":"\u00cb",
		  "î":"\u00ee", "ï":"\u00ef",
		  "Î":"\u00ce", "Ï":"\u00cf",
		  "ô":"\u00f4", "ö":"\u00f6",
		  "Ô":"\u00d4", "Ö":"\u00d6",
		  "œ":"\u0153"
	};
	var oe_regex = new RegExp(c['œ'], 'g');
	var normal_nbsp_regex = new RegExp('[' +
					   Object.keys(nbsp_map).join('') +
					   ']', 'g');
	var filter_normal_nbsps
		= (text) => text.replace(normal_nbsp_regex, (a) => nbsp_map[a]);

	var text_filter = (text, result) => {
		// not in latin9 nor in the font. Don't feel like patching it.
		text = text.replace(oe_regex, 'oe');
		// nbsp.
		text = text.replace(/ ([:!?])/g, our_nbsp+'$1');
		// shorter nbsp
		text = text.replace(/ ;/g, shorter_nbsp+';');
		// there is sometimes the need to truly encode a nbsp,
		// e.g. in the insult generator, because the game will
		// internally append '!' at the end.
		text = filter_normal_nbsps(text);

		if (result.quality)
			text += '(' + result.quality + ')';
		return text;
	};

	// font patching: make a 'î' out of a 'â' and 'i'
	// font patching: make a 'ï' out of a 'ë' and 'i'
	// font patching: make a 'i' with an accent picked from from_e_char
	var figure_out_accented_i_patch = (font_context, from_e_char, to_i_char) => {
		var trem_rect;
		var base_rect = font_context.get_char_pos(from_e_char);
		var shift_i_x = 0;
		var shift_trem = { x: 0, y: 0};
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

		var dest_rect = font_context.get_char_pos(to_i_char);
		var i_src = font_context.get_char_pos('i');
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
		var trems_dst = {
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

	// Font patching: add î and ï out of ê and ë
	var figure_out_i_patch = font_context => {
		if (font_context.accented_i)
			return;
		figure_out_accented_i_patch(font_context, c['ë'], c['ï']);
		figure_out_accented_i_patch(font_context, c['ê'], c['î']);
		font_context.accented_i = "ok";
	};
	// font patching: fix "éèê" which are horrible.
	var figure_out_e_patch = font_context => {
		var crop_y = (c, y, shift_y) => {
			var rect = font_context.get_char_pos(c);
			rect.height = rect.height - Math.abs(y);
			rect.y += Math.max(y,0) + (shift_y || 0);
			return rect;
		};
		var blits = [
			{ from: crop_y('e', 5), to: crop_y(c['é'], 5)},
			{ from: crop_y('e', 5), to: crop_y(c['è'], 5)},
			{ from: crop_y('e', 5), to: crop_y(c['ê'], 5)},
			{ from: crop_y('e', 5), to: crop_y(c['ë'], 5)},
			{ from: crop_y(c['à'], -8), to: crop_y(c['è'], -8)},
			{ from: crop_y(c['á'], -8), to: crop_y(c['é'], -8)},
			{ from: crop_y(c['Â'], -9), to: crop_y(c['ê'], -9, 1)},
			{ from: crop_y(c['ä'], -8), to: crop_y(c['ë'], -8)}
		];
		blits.forEach(v => v.from.width = v.to.width);
		font_context.blits = font_context.blits.concat(blits);
	};
	// Patch the font metrics and figure out how to patch the font.
	var handle_metrics = font_context => {
		if (font_context.blits)
			return; // already done

		var space = font_context.get_char_pos(' ');
		font_context.set_char_pos(our_nbsp, space);
		// Turn a quarter em into a tens of em.
		space.width = Math.ceil(space.width / 2.5);
		font_context.set_char_pos(shorter_nbsp, space);

		font_context.blits = [];
		font_context.clears = [];
		if (space.height === 13)
			figure_out_e_patch(font_context);
		figure_out_i_patch(font_context);
	};
	// Patch the given font.  Easier than shipping 16 modified pngs.
	var patch_font = (image, font_context) => {
		handle_metrics(font_context);
		var ret, context;
		if (image.getContext) {
			ret = image;
			context = ret.getContext("2d");
		} else {
			ret = document.createElement("canvas");
			ret.width = image.width;
			ret.height = image.height;
			context = ret.getContext("2d");
			context.drawImage(image, 0, 0);
		}
		context.imageSmoothingEnabled = false;
		font_context.clears.forEach(v => {
			context.clearRect(v.x, v.y, v.width, v.height);
		});
		font_context.blits.forEach(v => {
			context.clearRect(v.to.x, v.to.y,
					  v.to.width, v.to.height);
			context.drawImage(ret,
					  v.from.x, v.from.y,
					  v.from.width, v.from.height,
					  v.to.x, v.to.y,
					  v.to.width, v.to.height);
			if (v.from.width !== v.to.width
			    || v.from.height !== v.to.height)
				console.log("FAIL");
		});
		return ret;
	};

	// Format a number.
	var format_number = (number, precision, unit, template) => {
		// toLocaleString("fr-FR") uses nbsp of course,
		// so patch them too.
		template = filter_normal_nbsps(template);
		if (unit && unit != "%")
			template = (
				template.slice(0, -unit.length)
				+ our_nbsp + template.slice(-unit.length)
			);
		return template;
	};

	var my_prefix = document.currentScript.src.slice(0, -"mod.js".length)
	window.localizeMe.add_locale("fr_FR", {
		from_locale:"en_US",
		map_file: my_prefix + "map_file.json",
		url_prefix: my_prefix,
		language: {
			en_US: "French",
			de_DE: "Franz" + c['ö'] + "sisch",
			fr_FR: "Fran" + c['ç'] + "ais",
		},
		text_filter: text_filter,
		patch_font: patch_font,
		number_locale: 'fr-FR',
		format_number: format_number
	});

})();
