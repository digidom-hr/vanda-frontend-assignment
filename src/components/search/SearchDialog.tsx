"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Icon } from "@/components/icons/Icon";
import styles from "./SearchDialog.module.css";
import { SearchPanel } from "./SearchPanel";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Global search: a header button that opens the search dialog; ⌘K / Ctrl+K or "/" open it from anywhere. */
export function SearchDialog() {
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((open) => !open);
      } else if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isEditable(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setOpen}>
      <Button className={styles.trigger} aria-label="Search series" aria-keyshortcuts="Meta+K Control+K /">
        <Icon name="search" />
        <span className={styles.label}>Search series</span>
        <kbd className={styles.kbd} aria-hidden="true">
          /
        </kbd>
      </Button>
      <ModalOverlay isDismissable className={styles.overlay}>
        <Modal className={styles.modal}>
          <Dialog className={styles.dialog} aria-labelledby="search-dialog-title">
            {({ close }) => (
              <>
                <div className={styles.head}>
                  <Heading slot="title" id="search-dialog-title" className={styles.title}>
                    Search series
                  </Heading>
                  <Button slot="close" className={styles.close} onPress={close}>
                    Close
                  </Button>
                </div>
                <SearchPanel variant="dialog" onNavigate={close} />
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
