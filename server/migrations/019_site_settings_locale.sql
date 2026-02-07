-- Site settings per locale: affiliate label and URL for EN and AM
-- Copy existing affiliate_label/affiliate_url to _en if not yet set

INSERT INTO site_settings (key, value)
SELECT 'affiliate_label_en', COALESCE((SELECT value FROM site_settings WHERE key = 'affiliate_label'), 'Affiliate Link')
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'affiliate_label_en');

INSERT INTO site_settings (key, value)
SELECT 'affiliate_url_en', COALESCE((SELECT value FROM site_settings WHERE key = 'affiliate_url'), 'https://www.wix.com')
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'affiliate_url_en');

INSERT INTO site_settings (key, value)
SELECT 'affiliate_label_am', COALESCE((SELECT value FROM site_settings WHERE key = 'affiliate_label'), 'Affiliate Link')
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'affiliate_label_am');

INSERT INTO site_settings (key, value)
SELECT 'affiliate_url_am', COALESCE((SELECT value FROM site_settings WHERE key = 'affiliate_url'), 'https://www.wix.com')
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'affiliate_url_am');
