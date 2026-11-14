-- Align the hosted bucket with PRD BR-27: 25 MB per order attachment and
-- Office document MIME types are accepted.

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/zip', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
where id = 'order-files';
