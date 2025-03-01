import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  BillDTO,
  BillItemsDTO,
  BillPaymentsDTO,
  FullBillDTO,
  PatientDTO,
} from "../../../../generated";
import { currencyFormat } from "../../../../libraries/formatUtils/currencyFormatting";
import {
  newBill,
  newBillReset,
  updateBill,
  updateBillReset,
} from "../../../../state/bills/actions";
import { IState } from "../../../../types";
import { ItemGroups } from "../consts";
import { usePendingBills } from "./pending_bill.hooks";
import { useItemPrices } from "./price.hooks";

export const useSelectedPatient = () => {
  const patient = useSelector<IState, PatientDTO>(
    (state: IState) => state.patients.selectedPatient.data ?? {}
  );
  return { patient };
};

export const useCurrentUser = () => {
  const user = useSelector(
    (state: IState) => state.main.authentication.data?.displayName
  );
  return user;
};

export const useFullBill = () => {
  const { patient } = useSelectedPatient();
  const user = useCurrentUser();

  const { data: pendings, status: pendingStatus } = usePendingBills(
    patient.code ?? 0
  );
  const creationMode = useMemo(() => !(pendings?.length > 0), [pendings]);

  const status = useSelector<IState, string>((state: IState) =>
    creationMode
      ? state.bills.newBill.status ?? "IDLE"
      : state.bills.updateBill.status ?? "IDLE"
  );

  const [bill, setBill] = useState<BillDTO>(() => {
    return (
      pendings[0]?.billDTO ?? {
        id: 0,
        date: new Date(Date.now()).toISOString(),
        patName: patient?.firstName,
        patient: true,
        patientDTO: patient,
        user: user,
      }
    );
  });
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [itemToEdit, setItemToEdit] =
    useState<Record<string, any> | undefined>();
  const [billItems, setBillItems] = useState<BillItemsDTO[]>([]);
  const [billPayments, setBillPayments] = useState<BillPaymentsDTO[]>([]);
  const [fullBill, setFullBill] = useState<FullBillDTO>({
    billDTO: bill,
    billItemsDTO: billItems,
    billPaymentsDTO: billPayments,
  });

  const saveBill = useCallback(() => {
    creationMode
      ? dispatch(newBill(fullBill))
      : dispatch(updateBill(bill.id ?? 0, fullBill));
  }, [fullBill, creationMode, dispatch]);

  const { prices } = useItemPrices(pendings[0]?.billDTO?.listId);
  const itemsRowData = useMemo(() => {
    return billItems.map((item) => {
      const priceDTO = prices.find(
        (e) => e.id == item.priceId || e.item == item.itemId
      );
      const groupLabel = Object.entries(ItemGroups).find(
        (e) => e[1].id == priceDTO?.group
      );
      return {
        id: item.id,
        itemId: item?.itemId,
        groupId: groupLabel ? groupLabel[1].id : ItemGroups.other.id,
        group: t(groupLabel ? groupLabel[1].value : ItemGroups.other.value),
        description: item.itemDescription,
        quantity: item.itemQuantity,
        amount: currencyFormat(item.itemAmount),
        itemAmount: item.itemAmount,
      };
    });
  }, [billItems]);

  const handleBillEdit = useCallback(
    (billDTO: BillDTO) => setBill({ ...billDTO }),
    [bill]
  );
  const handleAddPayment = useCallback(
    (values: Record<string, any>) =>
      setBillPayments([
        ...billPayments,
        {
          id: billPayments.length + 1,
          amount: values?.paymentAmount,
          date: values?.paymentDate,
          billId: bill.id,
          user: user,
        },
      ]),
    [billPayments]
  );
  const handleAddItem = useCallback(
    (itemDTO: BillItemsDTO) => {
      itemDTO.billId = bill.id;
      setBillItems([...billItems, itemDTO]);
    },
    [billItems]
  );
  const handleEditItem = useCallback(
    (itemDTO: BillItemsDTO) => {
      const items = billItems.map((item) =>
        item.id == itemDTO.id ? itemDTO : item
      );
      setBillItems([...items]);
      setItemToEdit(undefined);
    },
    [billItems]
  );
  const handleDeletePayment = useCallback(
    (paymentDTO: BillPaymentsDTO) => {
      let payments = billPayments.filter((value) => value.id != paymentDTO.id);
      setBillPayments([...payments]);
    },
    [billPayments]
  );
  const handleDeleteItem = useCallback(
    (item: any) => {
      let items = billItems.filter((value) => value.id != item.id);
      setBillItems([...items]);
    },
    [billItems]
  );
  useEffect(() => {
    setFullBill(() => {
      return { ...fullBill, billDTO: bill };
    });
  }, [bill]);
  useEffect(() => {
    setFullBill(() => {
      return { ...fullBill, billItemsDTO: billItems };
    });
  }, [billItems]);
  useEffect(() => {
    setFullBill(() => {
      return { ...fullBill, billPaymentsDTO: billPayments };
    });
  }, [billPayments]);

  useEffect(() => {
    if (!creationMode) {
      const fullBill = pendings[0];
      setBill({ ...fullBill.billDTO });
      setBillItems([...(fullBill.billItemsDTO ?? [])]);
      setBillPayments([...(fullBill.billPaymentsDTO ?? [])]);
    }
  }, [creationMode, patient]);

  const billTotal = useMemo(() => {
    return billItems
      .map((e) => (e.itemQuantity ?? 0) * (e.itemAmount ?? 0))
      .reduce((acc, current) => acc + current, 0);
  }, [billItems]);

  const paymentTotal = useMemo(() => {
    return billPayments
      .map((e) => e?.amount ?? 0)
      .reduce((acc, current) => acc + current, 0);
  }, [billPayments]);

  useEffect(() => {
    setBill(() => ({
      ...bill,
      amount: billTotal,
      balance: billTotal - paymentTotal,
    }));
  }, [billTotal, paymentTotal]);

  useEffect(() => {
    if (status === "SUCCESS") {
      creationMode ? dispatch(newBillReset()) : dispatch(updateBillReset());
    }
  }, [status]);

  return {
    fullBill,
    bill,
    billItems,
    billPayments,
    billTotal,
    paymentTotal,
    itemsRowData,
    itemToEdit,
    creationMode,
    status,
    saveBill,
    setItemToEdit,
    handleBillEdit,
    handleAddItem,
    handleEditItem,
    handleAddPayment,
    handleDeleteItem,
    handleDeletePayment,
  };
};
