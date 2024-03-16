```dataview
TABLE WITHOUT ID 
choice(title, link(file.link, title), file.link) as title, topics, TLDR
where contains(topics, [](.md))
```