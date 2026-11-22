import { db } from "./firebase.js";
import { collection, doc, getDoc, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { escapeHtml, formatDate, setupMenu } from "./shared.js";

const root = document.querySelector("#article-content");
document.querySelector("#year").textContent = new Date().getFullYear();
setupMenu();

function renderInteractiveCharts(container) {
  if (!window.Chart) return;
  container.querySelectorAll(".article-interactive-chart").forEach((wrapper) => {
    if (wrapper.dataset.rendered === "true") return;
    let rows = [];
    try { rows = JSON.parse(wrapper.dataset.chartRows || "[]"); } catch (_) {}
    if (!rows.length) return;
    const canvas = wrapper.querySelector("canvas") || document.createElement("canvas");
    if (!canvas.parentNode) wrapper.appendChild(canvas);
    const chartType = wrapper.dataset.chartType || "bar";
    const title = wrapper.dataset.chartTitle || "";
    const color = wrapper.dataset.chartColor || "#829c25";
    const background = wrapper.dataset.chartBg || "#ffffff";
    const suffix = wrapper.dataset.chartSuffix || "";
    wrapper.style.backgroundColor = background;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const isPie = chartType === "pie" || chartType === "doughnut";
    new Chart(canvas, {
      type: chartType,
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          label: "Collection",
          data: rows.map(r => r.value),
          backgroundColor: isPie ? rows.map((_, i) => [color,"#e76f51","#2a9d8f","#e9c46a","#6c63ff","#f28482"][i % 6]) : color,
          borderColor: color,
          borderWidth: 2,
          tension: .35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: isPie },
          title: { display: !!title, text: title },
          tooltip: {
            callbacks: {
              title(items) { return items.length ? items[0].label : ""; },
              label(item) { return `${Number(item.raw).toLocaleString()}${suffix}`; }
            }
          }
        }
      }
    });
    wrapper.dataset.rendered = "true";
  });
}


function safeArticleHtml(html = "") {
  const docNode = new DOMParser().parseFromString(html, "text/html");
  docNode.querySelectorAll("script,style,object,embed,form,svg,math").forEach((node) => node.remove());
  docNode.querySelectorAll("iframe").forEach((frame) => {
    try {
      const url = new URL(frame.getAttribute("src") || "");
      const match = url.hostname === "www.youtube-nocookie.com" && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname);
      if (!match) { frame.remove(); return; }
      frame.setAttribute("title", "YouTube video");
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      frame.setAttribute("allowfullscreen", "");
    } catch (_) { frame.remove(); }
  });
  docNode.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && value.startsWith("javascript:"))) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return docNode.body.innerHTML;
}

const slug = new URLSearchParams(location.search).get("slug");
if (!slug) {
  root.innerHTML = '<p class="muted">No article was selected. Return to the <a href="index.html">home page</a>.</p>';
} else {
  try {
    let found = null;
    // Resolve the public URL slug first. This avoids a permission-denied direct
    // document read preventing the slug query from running.
    const bySlug = await getDocs(
      query(
        collection(db, "posts"),
        where("slug", "==", slug),
        where("status", "==", "published"),
        limit(1)
      )
    );
    if (!bySlug.empty) {
      found = { id: bySlug.docs[0].id, ...bySlug.docs[0].data() };
    }

    // Fallback for older posts whose document ID is used as the URL.
    if (!found) {
      try {
        const byId = await getDoc(doc(db, "posts", slug));
        if (byId.exists() && byId.data().status === "published") {
          found = { id: byId.id, ...byId.data() };
        }
      } catch (idError) {
        console.debug("Direct article ID lookup was unavailable.", idError);
      }
    }
    if (!found) {
      root.innerHTML = '<p class="muted">This article could not be found or is not published.</p>';
    } else {
      const articleTitle = `${found.title || "Article"} — Flames`;
      const description = (found.excerpt || found.title || "Read this story on Flames.").replace(/\s+/g, " ").slice(0, 155);
      const canonicalUrl = `${location.origin}${location.pathname}?slug=${encodeURIComponent(found.slug || slug)}`;
      document.title = articleTitle;
      document.querySelector('meta[name="description"]').content = description;
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = canonicalUrl;
      const setMeta = (selector, value) => { const element = document.querySelector(selector); if (element) element.setAttribute("content", value); };
      setMeta('meta[property="og:title"]', articleTitle);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[property="og:url"]', canonicalUrl);
      setMeta('meta[name="twitter:title"]', articleTitle);
      setMeta('meta[name="twitter:description"]', description);
      if (found.imageUrl) setMeta('meta[property="og:image"]', found.imageUrl);
      const structuredData = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": found.title || "Flames article", "description": description,
        "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
        "datePublished": found.createdAt?.toDate ? found.createdAt.toDate().toISOString() : undefined,
        "dateModified": (found.updatedAt?.toDate ? found.updatedAt.toDate().toISOString() : undefined),
        "author": { "@type": "Person", "name": found.author || "Flames Editorial" },
        "publisher": { "@type": "Organization", "name": "Flames" },
        "image": found.imageUrl || undefined
      };
      let jsonLd = document.querySelector('#article-jsonld');
      if (!jsonLd) { jsonLd = document.createElement('script'); jsonLd.id = 'article-jsonld'; jsonLd.type = 'application/ld+json'; document.head.appendChild(jsonLd); }
      jsonLd.textContent = JSON.stringify(structuredData);
      const image = found.imageUrl ? `<img class="article-cover" src="${escapeHtml(found.imageUrl)}" alt="${escapeHtml(found.title)}" loading="eager">` : "";
      root.innerHTML = `<header class="article-header">
        <div class="post-meta"><span class="category-tag">${escapeHtml(found.category || "Other")}</span><span>${escapeHtml(formatDate(found.createdAt))}</span></div>
        <h1>${escapeHtml(found.title)}</h1>
        ${found.excerpt ? `<p class="article-excerpt">${escapeHtml(found.excerpt)}</p>` : ""}
      </header>${image}<article class="article-content" style="background:${escapeHtml(found.contentBackground || "#ffffff")};padding:18px;border-radius:12px">${safeArticleHtml(found.contentHtml || "")}</article>`;
      const articleBody = root.querySelector(".article-content");
      articleBody.querySelectorAll("table").forEach((table) => {
        if (table.parentElement?.classList.contains("article-table-wrap")) return;
        const wrap = document.createElement("div");
        wrap.className = "article-table-wrap";
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      });
      renderInteractiveCharts(articleBody);
    }
  } catch (error) {
    console.error(error);
    root.innerHTML = '<p class="muted">Could not load this article. Please check your Firestore rules and connection.</p>';
  }
}
