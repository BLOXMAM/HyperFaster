// ملحق تجريبي: عند الضغط على الزر تظهر رسالة تؤكد أن ملف js حُمّل من التطبيق
document.addEventListener("DOMContentLoaded", function () {
  var n = 0;
  document.getElementById("extras-test-btn").addEventListener("click", function () {
    n++;
    document.getElementById("extras-test-msg").textContent = "✅ ملف js يعمل — الضغطة رقم " + n;
  });
});
