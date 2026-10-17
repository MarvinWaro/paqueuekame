-- Court colors the team picks in Team settings. Players see them on the live link too.
ALTER TABLE teams ADD COLUMN court_theme TEXT NOT NULL DEFAULT 'classic';
