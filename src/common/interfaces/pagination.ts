export interface Pagination<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}
