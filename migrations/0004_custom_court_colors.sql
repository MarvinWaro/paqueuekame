-- A team's own court colors (hex). Used when teams.court_theme = 'custom'; kept when switching back to a preset.
ALTER TABLE teams ADD COLUMN court_color TEXT;
ALTER TABLE teams ADD COLUMN kitchen_color TEXT;
