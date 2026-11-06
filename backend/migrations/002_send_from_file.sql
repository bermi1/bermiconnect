-- Send from Excel: campaigns built from an uploaded sheet with pre-rendered messages.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'groups' CHECK (source IN ('groups','file'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template text;
-- Original spreadsheet row reference (e.g. "Row 5" / sheet row number) so reports can be matched back.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS row_ref text;
