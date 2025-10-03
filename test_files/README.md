# Test Files Directory

هذا المجلد لحفظ الملفات التي سيستخدمها البوت للردود الآلية.

## مثال على البنية:

```
test_files/
├── accounting/
│   ├── summary.pdf          # ملخص المحاسبة
│   ├── lecture1.pdf         # المحاضرة الأولى
│   └── assignment1.jpg      # صورة Assignment 1
├── statistics/
│   ├── summary.pdf
│   └── lecture1.pdf
└── schedule.jpg             # جدول المحاضرات
```

## ملاحظات:

- ضع الملفات في هذا المجلد أو في أي مسار آخر على السيرفر
- تأكد من تحديث المسارات في config.json
- استخدم مسارات مطلقة (absolute paths) في الإعدادات

## مثال على المسارات:

```json
{
  "keywords": ["ملخص محاسبة"],
  "responseType": "document",
  "filePath": "/home/runner/work/what-sapp_bot/what-sapp_bot/test_files/accounting/summary.pdf"
}
```
