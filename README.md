<!-- NEVER document real default login credentials here, even for local dev. See CONTRIBUTING or internal notes instead. -->
# ⚖️ المنظومة القضائية السحابية لإدارة المحاكم والمكاتب القانونية
### Cloud Legal & Court Session Management SaaS Platform

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Legal%20SaaS-093A2A?style=for-the-badge&logo=scales&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-Express%205-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-Google%20Sheets%20%7C%20Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="DB" />
  <img src="https://img.shields.io/badge/AI-Extraction%20Engine-B88A3B?style=for-the-badge&logo=openai&logoColor=white" alt="AI" />
</p>

---

## 📖 نبذة عن المنصة (About the Project)

نظام سحابي متكامل واحترافي مصمم خصيصاً للمحامين، المكاتب، والشركات القانونية في مختلف الدول والأنظمة القضائية العربية (فلسطين، الأردن، مصر، السعودية، دول الخليج، وغيرها).

يقوم النظام بتحويل الإشعارات والرسائل النصية (`SMS`) الخام الواردة من المحاكم إلى بيانات منظمة ومفهرسة تلقائياً باستخدام تقنيات الذكاء الاصطناعي، مع جدولة التنبيهات، تتبع المهل الزمنية، وإدارة شاملة للجلسات، الوكالات، الأحكام القضائية، والمهام اليومية.

---

## ✨ المميزات الرئيسية (Key Features)

### 1. 🧠 التحليل الذكي لإشعارات المحاكم (AI Court SMS Extraction)
* استخراج فوري وتلقائي لكافة تفاصيل الجلسة:
  * **رقم القضية** وتصنيفها.
  * **أطراف الدعوى** (المدعي، المدعى عليه، أو المحيل والمحال إليه).
  * **المحكمة والدائرة القضائية** (محاكم الصلح، البداية، الاستئناف، التمييز، المحاكم الشرعية والتجارية والعمالية).
  * **تاريخ ووقت الجلسة** بدعم كامل للتقويمين **الميلادي** و**الهجري**.
  * **نوع الجلسة وملاحظاتها** (مرافعة، استماع، نطق بالحكم).

### 2. 📅 إدارة الجلسات والعد التنازلي (Hearings & Sessions Management)
* فلترة فورية للجلسات: (اليوم، قادمة، منتهية، ملغية).
* شارات توقيت تنازلي ذكية توضح الأيام والساعات المتبقية لكل جلسة.
* نظام تذكير تلقائي مجدول يرسل تنبيهات استباقية (قبل 24 ساعة وقبل 6 ساعات).

### 3. 🛡️ بنية سحابية متعددة المستويات (SaaS Architecture)
* **بوابة المحامي (Lawyer Workspace):** مساحة عمل مستقلة للمحامي لإدارة قضاياه وجلساته وتقاريره اليومية.
* **بوابة المشرف العام (Admin Portal Gateway):** لوحة تحكم عليا حصرية لإدارة حسابات المشتركين، تحديد الأدوار (`Admin` / `Staff - المحامي`)، وتخصيص قواعد البيانات وملفات Google Sheets لكل مشترك بشكل منفصل ومنعزل تماماً.

### 4. 📂 موديولات قانونية شاملة (Legal Modules)
* **سجل الوكالات الشرعية والقانونية (`/poa`):** أرشفة الوكالات، أنواعها، وتواريخ سريانها وانتهائها.
* **سجل الأحكام والقرارات القضائية (`/judgments`):** متابعة منطوق الأحكام النهائية والابتدائية وأرقام الإعلامات.
* **إدارة المهام والتكليفات القانونية (`/tasks`):** تنظيم أولويات العمل ومتابعة المهل مع زر إرسال تنبيهات واتساب فورية.
* **تقارير الجلسات الاحترافية (`/reports`):** توليد تقارير رسمية جاهزة للطباعة والتصدير بصيغة `PDF`.

### 5. 🎨 تصميم راقٍ وعصري (Premium Legal Design)
* واجهة مستخدم مبنية بأحدث معايير التصميم العالمي (أخضر زمردي داكن `#093A2A` مع لمسات برونزية وذهبية ملكية `#B88A3B`).
* دعم كامل للاتجاه من اليمين إلى اليسار (`RTL`) واللغة العربية بأفضل الخطوط.
* تأثيرات الزجاج المصقول الحديثة (**Frosted Glassmorphism**) مع دعم الوضعين الداكن والفاتح (`Dark / Light Mode`).

---

## 🔑 بوابات الدخول (Authentication Portals)

| البوابة | الرابط المحلي | اسم المستخدم | كلمة المرور | الصلاحية |
| :--- | :--- | :---: | :---: | :---: |
| **بوابة المحامي** | [http://localhost:5173/login](http://localhost:5173/login) | `<username>` | `<password>` | مساحة عمل المحامي |
| **بوابة المشرف العام** | [http://localhost:5173/admin/login](http://localhost:5173/admin/login) | `<admin-username>` | `<admin-password>` | إدارة المنصة والمستخدمين |

---

## 🏗️ هيكلية المشروع (Architecture & Tech Stack)

```
Low/
├── api/                               # معالجات خادم Vercel Serverless
├── artifacts/
│   ├── api-server/                    # خادم الـ API والواجهة الخلفية (Express 5, Node.js)
│   │   ├── src/config/                # إدارة الإعدادات والمفاتيح
│   │   ├── src/routes/                # مسارات الـ REST API (Auth, Sessions, Tasks, etc.)
│   │   ├── src/services/              # خدمات التكامل (Google Sheets, Supabase, AI, PDF)
│   │   └── src/utils/                 # محركات التقويم الهجري والميلادي والجدولة
│   └── court-session-management/      # تطبيق الواجهة الأمامية (React 19 + Vite)
│       ├── src/components/            # مكونات الواجهة وقوالب التصميم
│       ├── src/pages/                 # صفحات التطبيق (Dashboard, Sessions, POA, Admin)
│       └── src/lib/                   # أدوات مساعدة وتكامل React Query
├── lib/
│   ├── api-client-react/              # خطافات React Query المولدة تلقائياً
│   ├── api-spec/                      # توثيق OpenAPI Spec
│   └── api-zod/                       # مخططات التحقق من البيانات (Zod Validators)
└── pnpm-workspace.yaml                # إعدادات الـ Monorepo
```

---

## 🚀 التشغيل المحلي (Quick Start)

### 1. المتطلبات الأساسية
* **Node.js** (إصدار 20 أو أحدث، يُفضل v24).
* مدير الحزم **pnpm** أو **npx**.

### 2. تثبيت التبعيات
```bash
npx --yes pnpm install
```

### 3. تشغيل النظام (الواجهة الأمامية والخلفية معاً)
```bash
# تشغيل خادم الـ API (المنفذ 5000)
npx --yes pnpm --filter @workspace/api-server run build
node artifacts/api-server/dist/index.mjs

# تشغيل واجهة المستخدم (المنفذ 5173) في نافذة أخرى
npx --yes pnpm --filter @workspace/court-session-management run dev
```

افتح المتصفح على:
👉 **[http://localhost:5173/](http://localhost:5173/)**

---

## 🔒 الأمان وحماية البيانات (Security & Permissions)

* **عزل الحسابات (Data Isolation):** كل مستخدم/محامٍ يستطيع الارتباط بقاعدة بيانات أو Google Sheet مستقلة تماماً لا يطلع عليها غيره.
* **حماية المسارات (Guarded Routes):** مسارات الإدارة محمية برمجياً بطبقتين: `AdminGuard` على الواجهة و `requireAdmin` في الواجهة الخلفية.
* **الجلسات المشفرة:** ملفات تعريف الارتباط (`Cookies`) موقعة ومشفرة عبر `cookie-parser` مع حماية `HttpOnly` و `SameSite`.

---

<p align="center">
  <b>تم التطوير والإعداد بواسطة المهندس يوسف خلف</b><br>
  Developed with ❤️ for Modern Arab Law Practices
</p>
