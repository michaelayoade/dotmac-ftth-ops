import {
  Table,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
  TableBody,
  useToast,
  useModal,
  useNavigation,
  NotificationProvider,
  Modal,
  Toast,
} from "./src/index";

const primitives = {
  Table,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
  TableBody,
  useToast,
  useModal,
  useNavigation,
  NotificationProvider,
  Modal,
  Toast,
};

console.log("Primitives exports working", Object.keys(primitives));
