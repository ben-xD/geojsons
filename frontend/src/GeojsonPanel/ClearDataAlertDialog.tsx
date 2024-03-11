import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bomb } from "lucide-react";
import { resetStateAndReloadPage } from "@/store/store";

export const ClearDataAlertDialog = () => {
  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Bomb />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all data?</AlertDialogTitle>
          <AlertDialogDescription>
            {
              "This will permanently delete any local data and refresh the page. You can't undo this."
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => resetStateAndReloadPage()}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
