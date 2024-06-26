document.addEventListener("DOMContentLoaded", function() {
    document.querySelector(".hamburger").addEventListener("click", function(){
        document.querySelector(".wrapper").classList.toggle("collapse");
    });
});



document.addEventListener("DOMContentLoaded", function() {
    const currentUrl = window.location.pathname;
    const sidebarLinks = document.querySelectorAll(".sidebar-link");

    sidebarLinks.forEach(link => {
        if (link.getAttribute("href") === currentUrl) {
            link.classList.add("active");
        }
    });
});
