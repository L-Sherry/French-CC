(() => {
	// This is normally U+00A0, except the game uses /\s/ to check for
	// space to break, and it matches, so it would breaks our non-breaks.
	var our_nbsp = '\u0080';
	// This would be U+202F
	var shorter_nbsp = '\u0081';

	var text_filter = (text, result) => {
		// not in latin9 nor in the font. Don't feel like patching it.
		text = text.replace(/œ/g, 'oe');
		// nbsp.
		
		text = text.replace(/ ([:!?])/g, our_nbsp+'$1');
		// shorter nbsp
		text = text.replace(/ ;/g, shorter_nbsp+';');

		if (result.quality)
			text += '(' + result.quality + ')';
		return text;
	};
	// font patching: make a 'ï' out of a 'ë' and 'i'
	var figure_out_itrems = font_context => {
		if (font_context.trems)
			return;
		var trem_rect;
		var base_rect = font_context.get_char_pos('ë');
		var shift_i_x = 0;
		var shift_trem = { x: 0, y: 0};
		switch (base_rect.height) {
		case 7:
			trem_rect = { x: 1, y: 0, width: 3, height: 1 };
			shift_i_x = 1;
			shift_trem = { x: -1, y: 0 };
			break;
		case 13:
			trem_rect = { x: 0, y: 3, width: 5, height: 2 };
			shift_i_x = 1;
			break;
		case 16:
			// taking an extra row of emptyness to erase i's dot.
			trem_rect = { x: 1, y: 3, width: 5, height: 3 };
			shift_trem = { x: -1, y: 1 };
			break;
		}

		var dest_rect = font_context.get_char_pos('ï');
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

		font_context.set_char_pos('ï', dest_rect);
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
			{ from: crop_y('e', 5), to: crop_y('é', 5)},
			{ from: crop_y('e', 5), to: crop_y('è', 5)},
			{ from: crop_y('e', 5), to: crop_y('ê', 5)},
			{ from: crop_y('e', 5), to: crop_y('ë', 5)},
			{ from: crop_y('à', -8), to: crop_y('è', -8)},
			{ from: crop_y('á', -8), to: crop_y('é', -8)},
			{ from: crop_y('Â', -9), to: crop_y('ê', -9, 1)},
			{ from: crop_y('ä', -8), to: crop_y('ë', -8)}
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
		figure_out_itrems(font_context);
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
	window.localizeMe.add_locale("fr_FR", {
		from_locale:"en_US",
		map_file: "mods/french/map_file.json",
		language: {
			en_US: "French",
			de_DE: "Französisch",
			fr_FR: "Français",
		},
		text_filter: text_filter,
		patch_font: patch_font
	});

})();
