# Game lists

Open **Game lists** in the sidebar and create a named checklist, such as **Devil May Cry saga**. Choose the list, expand **Add games to this list**, then search existing library games or enter a new title and platform. New records start as Planned. An exact title/platform match (case insensitive) reuses an existing record, including an archived one. Different editions or platforms can have separate records.

Each list shows its completed percentage, completed count and remaining count. A checked game means **Completed**, rather than merely started. Empty lists show 0%. Percentages round down so an unfinished list never displays 100%.

Checking a game marks its library record Completed and restores it if archived. No completion date is invented; use **Edit game** to enter one. Unchecking changes the status to Planned and clears the completion date, retaining notes, rating, playtime and platinum fields. Editing from a list also restores an archived record. Editing a status in the library updates the corresponding progress in every list.

Rename or delete lists independently. Removing a membership or deleting a list never deletes or archives a library game. Games can belong to several lists, sharing their status in all of them. Archived games remain part of their lists and their progress.

Lists are local SQLite data. Schema 3 adds list and membership tables with foreign keys. Existing schema 1/2 databases receive a uniquely named safety backup before migration. The interface supports up to 100 lists and fetches members in pages of 100; counts cover the entire list. List search returns the first 100 matching active library games; narrow the search for larger libraries. Order follows addition order; manual reordering and automatic franchise discovery are not included.
