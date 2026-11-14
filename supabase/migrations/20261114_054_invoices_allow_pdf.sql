-- Invoices may also be PDF files (up to 10 MB); photos stay limited to 5 MB in the app.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    file_size_limit = 10485760
where id = 'invoices';
