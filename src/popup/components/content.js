let sidebarContainer = null;
let iframe = null;
let resizer = null;
let isResizing = false;

function toggleSidebar() {
  if (sidebarContainer) {
    sidebarContainer.style.display = sidebarContainer.style.display === "none" ? "flex" : "none";
  } else {
    // 1. إنشاء الحاوية الرئيسية التي ستضم المقبض والنافذة
    sidebarContainer = document.createElement("div");
    sidebarContainer.style.position = "fixed";
    sidebarContainer.style.top = "0";
    sidebarContainer.style.right = "0";
    sidebarContainer.style.width = "400px"; // العرض الافتراضي
    sidebarContainer.style.height = "100vh";
    sidebarContainer.style.zIndex = "9999999";
    sidebarContainer.style.display = "flex"; // لاستيعاب المقبض والنافذة بجوار بعضهما
    sidebarContainer.style.boxShadow = "-5px 0 15px rgba(0,0,0,0.1)";
    sidebarContainer.style.backgroundColor = "#ffffff";
    
    // 2. إنشاء مقبض السحب (Resizer)
    resizer = document.createElement("div");
    resizer.style.width = "6px"; // عرض المقبض
    resizer.style.cursor = "ew-resize"; // شكل الماوس (سهمين متعاكسين)
    resizer.style.backgroundColor = "#e0e0e0";
    resizer.style.zIndex = "10";
    resizer.style.transition = "background-color 0.2s";
    
    // تأثيرات لونية عند مرور الماوس على المقبض
    resizer.onmouseover = () => { if (!isResizing) resizer.style.backgroundColor = "#ff4757"; };
    resizer.onmouseout = () => { if (!isResizing) resizer.style.backgroundColor = "#e0e0e0"; };

    // 3. إنشاء الـ iframe (واجهة الإضافة)
    iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("popup/popup.html");
    iframe.style.flex = "1"; // ليأخذ كل المساحة المتبقية بجوار المقبض
    iframe.style.border = "none";
    iframe.style.height = "100vh";
    iframe.style.overflow = "hidden";
    iframe.style.boxSizing = "border-box";

    // تجميع العناصر داخل الصفحة
    sidebarContainer.appendChild(resizer);
    sidebarContainer.appendChild(iframe);
    document.body.appendChild(sidebarContainer);

    // 4. برمجة منطق السحب (Drag Logic)
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizer.style.backgroundColor = "#ff4757"; // تثبيت اللون الأحمر أثناء السحب
      document.body.style.userSelect = 'none'; // منع تحديد النصوص المزعج أثناء السحب
      iframe.style.pointerEvents = 'none'; // *نقطة حاسمة*: منع الـ iframe من سرقة حركة الماوس أثناء السحب
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      // حساب العرض الجديد بناءً على موضع الماوس (عرض الشاشة - موضع الماوس الأفقي)
      let newWidth = window.innerWidth - e.clientX;
      
      // وضع حدود أقصى وأدنى للعرض حتى لا يختفي الشريط أو يغطي الشاشة بالكامل
      if (newWidth < 300) newWidth = 300; // الحد الأدنى
      if (newWidth > 800) newWidth = 800; // الحد الأقصى
      
      // تطبيق العرض الجديد
      sidebarContainer.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.style.backgroundColor = "#e0e0e0"; // إعادة لون المقبض
        document.body.style.userSelect = 'auto'; // إعادة تفعيل تحديد النصوص
        iframe.style.pointerEvents = 'auto'; // إعادة تفعيل التفاعل مع الـ iframe
      }
    });
  }
}

// الاستماع لرسائل الخلفية وواجهة الإضافة
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleSidebar") {
    toggleSidebar();
    sendResponse({ status: "toggled" });
  } 
  else if (request.type === "pauseVideo") {
    const video = document.querySelector("video");
    if (video && !video.paused) {
      video.pause();
    }
    sendResponse({ status: "paused" });
  }
});